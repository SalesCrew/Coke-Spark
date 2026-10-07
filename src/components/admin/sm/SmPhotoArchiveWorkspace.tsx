"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ExternalLink, Grid3X3, ImageOff, Images, List, RefreshCw, Search, X } from "lucide-react";
import { AdminDatePicker, AdminDropdown, AdminFilterControlStyles } from "@/components/admin/AdminFilterControls";
import { readAuthSession, smPhotoArchiveApi, subscribeAuthSession } from "@/lib/api/backend";
import type { SmArchivePhoto, SmArchivePhotoFacets, SmArchivePhotoList, SmArchivePhotoUrl, SmPhotoArchiveApi, SmPhotoArchiveFilters } from "@/types/smPhotoArchive";
import styles from "./SmPhotoArchiveWorkspace.module.css";

const readOwner = () => { const user = readAuthSession()?.user; return user && ["admin", "sm_admin"].includes(user.role) ? user.id : null; };
const serverOwner = () => null;
const dateLabel = (date: string) => new Intl.DateTimeFormat("de-AT", { timeZone: "Europe/Vienna", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(`${date}T12:00:00Z`));
const errorText = (error: unknown) => error instanceof Error ? error.message : "Das Fotoarchiv konnte nicht geladen werden.";
const typeLabel = (photo: SmArchivePhoto) => photo.SMDurcharbeitCatalogScope === "SMDurcharbeit" ? "Durcharbeit" : "Standardfragebogen";
const photoTypeClass = (photo: SmArchivePhoto) => `${styles.type} ${photo.SMDurcharbeitCatalogScope === "SMDurcharbeit" ? styles.durcharbeit : ""}`;
const cleanFilters = (filters: SmPhotoArchiveFilters) => Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== "" && value !== undefined)) as SmPhotoArchiveFilters;

export function SmPhotoArchiveWorkspace({ api = smPhotoArchiveApi }: { api?: SmPhotoArchiveApi }) {
  const owner = useSyncExternalStore(subscribeAuthSession, readOwner, serverOwner);
  return owner ? <PhotoArchive key={owner} owner={owner} api={api} /> : <ArchiveSkeleton />;
}

function ArchiveSkeleton() {
  return <div className={styles.grid} aria-label="Fotos werden geladen" aria-busy="true">{Array.from({ length: 6 }, (_, index) => <div className={styles.loadingCard} key={index} aria-hidden="true"><span className={styles.skeleton} /><span className={styles.skeleton} style={{ width: "55%" }} /><span className={styles.skeleton} style={{ width: "75%" }} /></div>)}</div>;
}

export function PhotoArchive({ owner, api, currentOwner = readOwner }: { owner: string; api: SmPhotoArchiveApi; currentOwner?: () => string | null }) {
  const [filters, setFilters] = useState<SmPhotoArchiveFilters>({}), [searchDraft, setSearchDraft] = useState("");
  const [page, setPage] = useState(1), [view, setView] = useState<"grid" | "list">("grid"), [reload, setReload] = useState(0);
  const [data, setData] = useState<{ key: string; value: SmArchivePhotoList } | null>(null), [facets, setFacets] = useState<{ key: string; value: SmArchivePhotoFacets } | null>(null);
  const [urls, setUrls] = useState<{ key: string; value: Record<string, SmArchivePhotoUrl> } | null>(null);
  const [loading, setLoading] = useState(true), [error, setError] = useState<string | null>(null), [photoError, setPhotoError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null), [exporting, setExporting] = useState(false), [progress, setProgress] = useState("");
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const alive = useRef(true), exportBusy = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    const timeout = setTimeout(() => { setFilters(current => cleanFilters({ ...current, search: searchDraft.trim() })); setPage(1); setSelectedId(null); }, 220);
    return () => clearTimeout(timeout);
  }, [searchDraft]);
  const queryKey = JSON.stringify({ ...filters, page, pageSize: 30 }), facetKey = JSON.stringify({ from: filters.from, to: filters.to, SMDurcharbeitCatalogScope: filters.SMDurcharbeitCatalogScope });
  const matching = data?.key === queryKey ? data.value : null, matchingUrls = urls?.key === queryKey ? urls.value : {};
  const currentFacets = facets?.key === facetKey ? facets.value : null;
  useEffect(() => {
    let active = true; setLoading(true); setError(null); setUrls(null); setPhotoError(null);
    void api.list(JSON.parse(queryKey)).then(value => { if (active && currentOwner() === owner) {
      setData({ key: queryKey, value });
      if (page > Math.max(1, Math.ceil(value.total / 30))) setPage(Math.max(1, Math.ceil(value.total / 30)));
    } })
      .catch(failure => { if (active) setError(errorText(failure)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [api, currentOwner, owner, page, queryKey, reload]);
  useEffect(() => {
    let active = true;
    void api.facets(JSON.parse(facetKey)).then(value => { if (active && currentOwner() === owner) setFacets({ key: facetKey, value }); })
      .catch(failure => { if (active) setError(errorText(failure)); });
    return () => { active = false; };
  }, [api, currentOwner, owner, facetKey, reload]);
  useEffect(() => {
    if (!matching?.photos.length) return;
    let active = true;
    const load = () => void api.urls(matching.photos.map(photo => photo.id)).then(result => {
      if (!active || currentOwner() !== owner) return;
      const signed = new Map(result.photos.map(photo => [photo.id, photo]));
      setUrls({ key: queryKey, value: Object.fromEntries(matching.photos.map(photo => [photo.id, signed.get(photo.id) ?? { id: photo.id, signedUrl: null, expiresAt: "" }])) });
      setPhotoError(result.photos.some(photo => !photo.signedUrl) || result.photos.length < matching.photos.length ? "Einzelne Fotovorschauen sind nicht verfügbar. Bitte aktualisieren." : null);
    }).catch(failure => { if (active) {
      setPhotoError(errorText(failure));
      setUrls({ key: queryKey, value: Object.fromEntries(matching.photos.map(photo => [photo.id, { id: photo.id, signedUrl: null, expiresAt: "" }])) });
    } });
    load();
    // Private URLs expire after ten minutes. Refresh while this page remains open.
    const interval = setInterval(load, 8 * 60 * 1000);
    return () => { active = false; clearInterval(interval); };
  }, [api, currentOwner, owner, matching, queryKey]);

  const update = (key: keyof SmPhotoArchiveFilters, value: string) => {
    setFilters(current => cleanFilters({ ...current, [key]: value === "all" ? undefined : value,
      ...(key === "SMDurcharbeitCatalogScope" ? { marketId: undefined, questionnaireId: undefined } : {}),
      ...(key === "from" && value && current.to && value > current.to ? { to: value } : {}),
      ...(key === "to" && value && current.from && value < current.from ? { from: value } : {}),
    })); setPage(1); setSelectedId(null);
  };
  const options = (key: "smUserId" | "marketId" | "questionnaireId", name: "smName" | "marketName" | "questionnaireName", all: string) => {
    const values = new Map((currentFacets?.facets ?? []).map(facet => [facet[key], facet[name]]));
    return [{ value: "all", label: all }, ...Array.from(values, ([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label, "de-AT"))];
  };
  const doExport = useCallback(async () => {
    if (exportBusy.current) return;
    exportBusy.current = true; setExporting(true); setProgress("Export vorbereiten …"); setError(null); setExportNotice(null);
    try {
      const { exportSmArchivePhotos } = await import("@/lib/exports/smPhotoArchiveExport");
      const result = await exportSmArchivePhotos({ api, filters, isCurrent: () => alive.current && currentOwner() === owner,
        onProgress: value => { if (alive.current && currentOwner() === owner) setProgress(value); } });
      if (alive.current && currentOwner() === owner) setExportNotice(`${result.count} Fotos als ZIP exportiert.`);
    } catch (failure) { if (alive.current && currentOwner() === owner) setError(errorText(failure)); }
    finally { exportBusy.current = false; if (alive.current) { setExporting(false); setProgress(""); } }
  }, [api, filters, owner, currentOwner]);
  useEffect(() => {
    const handler = () => { void doExport(); };
    window.addEventListener("admin:sm-fotoarchiv:export", handler);
    return () => window.removeEventListener("admin:sm-fotoarchiv:export", handler);
  }, [doExport]);
  const selectedIndex = matching?.photos.findIndex(photo => photo.id === selectedId) ?? -1, selectedPhoto = selectedIndex >= 0 ? matching!.photos[selectedIndex] : null;
  const pages = Math.max(1, Math.ceil((matching?.total ?? 0) / 30));
  return <main className={styles.workspace}>
    <AdminFilterControlStyles />
    <section className={styles.panel} aria-label="SM Fotoarchiv">
      <div className={styles.intro}>
        <div><div className={styles.title}><span className={styles.titleIcon}><Images size={16} /></span><div><p className={styles.eyebrow}>Shelf Merchandising · Fotoarchiv</p><h1>Bilder aus Foto-Fragen</h1></div></div>
          <div className={styles.stats}><span><strong>{loading ? "…" : matching?.total.toLocaleString("de-AT") ?? "—"}</strong>Fotos</span><span><strong>{loading ? "…" : matching?.stats.markets ?? "—"}</strong>Märkte</span><span><strong>{loading ? "…" : matching?.stats.questionnaires ?? "—"}</strong>Fragebögen</span></div></div>
        <div className={styles.actions}>
          <button className={styles.icon} disabled={loading} aria-label="Fotoarchiv aktualisieren" onClick={() => { setData(null); setReload(value => value + 1); }}><RefreshCw size={13} /></button>
          <div className={styles.switch} aria-label="Fotoansicht"><button aria-label="Rasteransicht" aria-pressed={view === "grid"} onClick={() => setView("grid")}><Grid3X3 size={14} /></button><button aria-label="Listenansicht" aria-pressed={view === "list"} onClick={() => setView("list")}><List size={15} /></button></div>
        </div>
      </div>
      <div className={styles.filters}>
        <div className={styles.field}><span>Fragebogentyp</span><AdminDropdown value={filters.SMDurcharbeitCatalogScope ?? "all"} options={[{ value: "all", label: "Alle Fragebogentypen" }, { value: "standard", label: "Standardfragebogen" }, { value: "SMDurcharbeit", label: "Durcharbeit" }]} ariaLabel="Fragebogentyp" placeholder="Alle Fragebogentypen" compact onChange={value => update("SMDurcharbeitCatalogScope", value)} /></div>
        {([["smUserId", "smName", "Shelf Merchandiser", "Alle SMs"], ["marketId", "marketName", "Markt", "Alle Märkte"], ["questionnaireId", "questionnaireName", "Fragebogen", "Alle Fragebögen"]] as const).map(([key, name, label, all]) => <div className={styles.field} key={key}><span>{label}</span><AdminDropdown value={filters[key] ?? "all"} options={options(key, name, all)} ariaLabel={label} placeholder={all} compact searchable disabled={!currentFacets} onChange={value => update(key, value)} /></div>)}
        <label className={styles.field}><span>Suche</span><span className={styles.search}><Search size={13} /><input type="search" aria-label="Fotos suchen" value={searchDraft} maxLength={200} placeholder="Markt, SM oder Frage …" onChange={event => setSearchDraft(event.target.value)} /></span></label>
        <div className={styles.period}><span>Besuchszeitraum</span><AdminDatePicker value={filters.from ?? ""} ariaLabel="Besuchszeitraum von" onChange={value => update("from", value)} /><span>–</span><AdminDatePicker value={filters.to ?? ""} ariaLabel="Besuchszeitraum bis" onChange={value => update("to", value)} /><span>{!filters.from && !filters.to ? "Alle Daten" : ""}</span><button className={styles.button} onClick={() => { setFilters({}); setSearchDraft(""); setPage(1); setSelectedId(null); }}>Filter zurücksetzen</button></div>
      </div>
    </section>
    {error ? <div role="alert" className={styles.error}>{error}<button className={styles.button} onClick={() => { setData(null); setReload(value => value + 1); }}>Erneut laden</button></div> : null}
    {exportNotice ? <div role="status" className={styles.notice}>{exportNotice}</div> : null}
    {exporting ? <div role="status" className={styles.notice}>{progress}</div> : null}
    {photoError ? <div role="status" className={styles.error}>{photoError}<button className={styles.button} onClick={() => { setData(null); setReload(value => value + 1); }}>Vorschauen aktualisieren</button></div> : null}
    {currentFacets?.truncated ? <p className={styles.muted}>Viele Filteroptionen: Nutze die Suche oder grenze den Zeitraum ein.</p> : null}
    <section className={styles.content} aria-label="Archivfotos" aria-busy={loading}>
      {loading && !matching ? <ArchiveSkeleton /> : matching?.photos.length ? view === "grid" ? <div className={styles.grid}>{matching.photos.map(photo => <button className={styles.card} key={photo.id} onClick={() => setSelectedId(photo.id)} aria-label={`Foto öffnen: ${photo.marketName}, ${photo.questionText}, ${photo.fileName ?? "Foto"}`}>
        <PhotoPreview photo={photo} url={matchingUrls?.[photo.id]} /><div className={styles.cardText}><div className={styles.cardTop}><span className={photoTypeClass(photo)}>{typeLabel(photo)}</span><span>{dateLabel(photo.workDate)}</span></div><h2>{photo.marketName}</h2><p className={`${styles.muted} ${styles.truncate}`}>{photo.smName} · {photo.city}</p><p className={`${styles.muted} ${styles.truncate}`}>{photo.questionnaireName}</p><div className={styles.question}>{photo.questionText}</div></div>
      </button>)}</div> : <div className={`${styles.panel} ${styles.tableWrap}`}><table className={styles.table}><thead><tr>{["Foto", "Besuch", "Markt / SM", "Fragebogen", "Frage", ""].map((label, index) => <th key={index} scope="col">{label}</th>)}</tr></thead><tbody>{matching.photos.map(photo => <tr key={photo.id}><td><button className={styles.thumb} onClick={() => setSelectedId(photo.id)} aria-label={`Foto öffnen: ${photo.fileName ?? photo.questionText}`}>{matchingUrls?.[photo.id]?.signedUrl ? <img src={matchingUrls[photo.id].signedUrl!} alt={photo.questionText} loading="lazy" onError={() => setPhotoError("Eine Fotovorschau ist abgelaufen oder nicht verfügbar. Bitte aktualisieren.")} /> : <ImageOff size={16} />}</button></td><td>{dateLabel(photo.workDate)}</td><td>{photo.marketName}<p className={styles.muted}>{photo.smName}</p></td><td><span className={photoTypeClass(photo)}>{typeLabel(photo)}</span><p className={styles.muted}>{photo.questionnaireName} · V{photo.questionnaireVersion}</p></td><td>{photo.questionText}</td><td><button className={styles.icon} aria-label={`Fotodetails zu ${photo.fileName ?? photo.questionText}`} onClick={() => setSelectedId(photo.id)}><ChevronRight size={13} /></button></td></tr>)}</tbody></table></div> : !error ? <div className={`${styles.panel} ${styles.empty}`}><Images size={30} strokeWidth={1.3} /><strong>{Object.keys(filters).length ? "Keine Fotos für diese Filter" : "Noch keine Fotos im SM Fotoarchiv"}</strong><span>Fotos aus abgeschlossenen Standard- und Durcharbeit-Fragebögen erscheinen hier.</span></div> : null}
    </section>
    <div className={styles.pagination}><span>{matching ? `${matching.total ? (page - 1) * 30 + 1 : 0}–${Math.min(page * 30, matching.total)} von ${matching.total} Fotos · Seite ${page} / ${pages}` : ""}</span><div className={styles.actions}><button className={styles.icon} aria-label="Vorherige Fotoseite" disabled={loading || page <= 1} onClick={() => { setPage(value => value - 1); setSelectedId(null); }}><ChevronLeft size={14} /></button><button className={styles.icon} aria-label="Nächste Fotoseite" disabled={loading || page >= pages} onClick={() => { setPage(value => value + 1); setSelectedId(null); }}><ChevronRight size={14} /></button></div></div>
    {selectedPhoto ? <PhotoDialog photo={selectedPhoto} url={matchingUrls?.[selectedPhoto.id]} onClose={() => setSelectedId(null)} onStep={delta => setSelectedId(matching!.photos[selectedIndex + delta].id)} previousDisabled={selectedIndex <= 0} nextDisabled={selectedIndex >= matching!.photos.length - 1} /> : null}
  </main>;
}

function PhotoPreview({ photo, url }: { photo: SmArchivePhoto; url?: SmArchivePhotoUrl }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [url?.signedUrl]);
  return <div className={styles.preview}>{url?.signedUrl && !failed ? <img src={url.signedUrl} alt={photo.questionText} loading="lazy" decoding="async" onError={() => setFailed(true)} /> : !url ? <span className={styles.skeleton} style={{ width: "100%", height: "100%" }} /> : <span className={styles.previewText}><ImageOff size={23} strokeWidth={1.4} />Vorschau nicht verfügbar</span>}</div>;
}

function PhotoDialog({ photo, url, onClose, onStep, previousDisabled, nextDisabled }: { photo: SmArchivePhoto; url?: SmArchivePhotoUrl; onClose: () => void; onStep: (delta: number) => void; previousDisabled: boolean; nextDisabled: boolean }) {
  const dialog = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [url?.signedUrl]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.focus();
    return () => { document.body.style.overflow = overflow; if (previous?.isConnected) previous.focus(); };
  }, []);
  return createPortal(<div className={styles.backdrop} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="sm-photo-title" className={styles.dialog} onKeyDown={event => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft" && !previousDisabled) { event.preventDefault(); onStep(-1); }
      if (event.key === "ArrowRight" && !nextDisabled) { event.preventDefault(); onStep(1); }
      if (event.key === "Tab") {
        const nodes = [...(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href]') ?? [])];
        const first = nodes[0], last = nodes.at(-1);
        if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last?.focus(); }
        if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog.current)) { event.preventDefault(); first?.focus(); }
      }
    }}>
      <button className={`${styles.icon} ${styles.close}`} aria-label="Foto schließen" onClick={onClose}><X size={15} /></button>
      <div className={styles.fullImage}>{url?.signedUrl && !failed ? <img src={url.signedUrl} alt={photo.questionText} onError={() => setFailed(true)} /> : <span className={styles.previewText}><ImageOff size={28} />Vorschau nicht verfügbar. Bitte aktualisieren.</span>}<div className={styles.imageNav}><button className={styles.icon} aria-label="Vorheriges Foto" disabled={previousDisabled} onClick={() => onStep(-1)}><ChevronLeft size={16} /></button><button className={styles.icon} aria-label="Nächstes Foto" disabled={nextDisabled} onClick={() => onStep(1)}><ChevronRight size={16} /></button></div></div>
      <aside className={styles.details}><span className={photoTypeClass(photo)}>{typeLabel(photo)}</span><h2 id="sm-photo-title">{photo.marketName}</h2><p className={styles.muted}>{[photo.address, photo.postalCode, photo.city].filter(Boolean).join(" · ")}</p>
        <dl>{[["Besuchsdatum", dateLabel(photo.workDate)], ["Shelf Merchandiser", photo.smName], ["Fragebogen", `${photo.questionnaireName} · Version ${photo.questionnaireVersion}`], ["Modul", photo.moduleName], ["Fotofrage", photo.questionText], ["Datei", photo.fileName ?? "Foto"], ["Bildgröße", photo.widthPx && photo.heightPx ? `${photo.widthPx} × ${photo.heightPx} px` : "—"]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
        {url?.signedUrl ? <a className={styles.button} href={url.signedUrl} target="_blank" rel="noreferrer"><ExternalLink size={12} />Original öffnen</a> : null}
        <Link className={styles.button} href={`/admin/sm/fbmanagement?submissionId=${encodeURIComponent(photo.submissionId)}&workDate=${photo.workDate}`}><ExternalLink size={12} />Fragebogen öffnen</Link>
      </aside>
    </div>
  </div>, document.body);
}
