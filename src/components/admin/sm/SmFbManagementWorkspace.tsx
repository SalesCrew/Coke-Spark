"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronLeft, ChevronRight, ClipboardCheck, History, LoaderCircle, Pencil, RefreshCw, X } from "lucide-react";
import { AdminDropdown, AdminFilterControlStyles } from "@/components/admin/AdminFilterControls";
import { BackendApiError, readAuthSession, smManagementApi, subscribeAuthSession } from "@/lib/api/backend";
import { currentSmPeriod, shiftSmPeriod, type SmPlanningPeriod } from "@/lib/sm/planningPeriod";
import { smManagementAnswerComplete, smManagementAnswerLabel, smManagementHidden, smManagementTime } from "@/lib/sm/management";
import type { SmAdminCorrection, SmAdminPhotoReceipt, SmManagedQuestion, SmManagementApi, SmManagementDetail, SmManagementHistory, SmManagementList, SmManagementPhoto, SmManagementQuery } from "@/types/smManagement";
import type { SmVisitAnswer } from "@/types/smVisit";
import { SmPlanningPeriodPicker } from "./SmPlanningPeriodPicker";
import { SmManagementAnswer, SmManagementPhotos } from "./SmManagementAnswer";
import styles from "./SmFbManagementWorkspace.module.css";

const readOwner = () => { const user = readAuthSession()?.user; return user && ["admin", "sm_admin"].includes(user.role) ? user.id : null; };
const serverOwner = () => null;
const dateLabel = (date: string) => new Intl.DateTimeFormat("de-AT", { timeZone: "Europe/Vienna", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(date.length === 10 ? `${date}T12:00:00Z` : date));
const errorText = (error: unknown) => error instanceof Error ? error.message : "Die Anfrage ist fehlgeschlagen. Bitte erneut versuchen.";

export function SmManagementSkeleton({ detail = false }: { detail?: boolean }) {
  return <div aria-busy="true" aria-label={detail ? "Fragebogen wird geladen" : "Fragebögen werden geladen"} style={{ padding: 20 }}>
    {Array.from({ length: detail ? 4 : 7 }, (_, index) => <div key={index} style={{ padding: "14px 0", display: "grid", gridTemplateColumns: detail ? "1fr" : "1fr 2fr 2fr 1fr", gap: 20 }}>
      {Array.from({ length: detail ? 3 : 4 }, (_, column) => <span key={column} aria-hidden="true" className={styles.skeleton} style={{ width: detail && column === 0 ? "65%" : "100%", height: detail && column === 2 ? 34 : 12 }} />)}
    </div>)}
  </div>;
}

export function SmFbManagementWorkspace({ api = smManagementApi }: { api?: SmManagementApi }) {
  const owner = useSyncExternalStore(subscribeAuthSession, readOwner, serverOwner);
  return owner ? <ManagementWorkspace key={owner} api={api} owner={owner} /> : <SmManagementSkeleton />;
}

export function ManagementWorkspace({ api, owner, currentOwner = readOwner }: { api: SmManagementApi; owner: string; currentOwner?: () => string | null }) {
  const [period, setPeriod] = useState<SmPlanningPeriod>(() => currentSmPeriod("month"));
  const [filters, setFilters] = useState({ smUserId: "all", marketId: "all", questionnaireId: "all", search: "" });
  const search = useDeferredValue(filters.search.trim());
  const [cursor, setCursor] = useState<{ date: string; id: string } | null>(null);
  const [previous, setPrevious] = useState<Array<{ date: string; id: string } | null>>([]);
  const [data, setData] = useState<{ key: string; result: SmManagementList } | null>(null);
  const [loading, setLoading] = useState(true), [error, setError] = useState<string | null>(null), [reload, setReload] = useState(0);
  const [selected, setSelected] = useState<string | null>(null), [notice, setNotice] = useState<string | null>(null);
  const closeSelected = useCallback(() => setSelected(null), []);
  const refreshAfterSave = useCallback(() => {
    setReload(value => value + 1);
    setNotice("Korrektur gespeichert. Originalantworten und Besuchszeiten bleiben erhalten.");
  }, []);
  const query: SmManagementQuery = { from: period.from, to: period.to,
    ...(filters.smUserId !== "all" ? { smUserId: filters.smUserId } : {}), ...(filters.marketId !== "all" ? { marketId: filters.marketId } : {}),
    ...(filters.questionnaireId !== "all" ? { questionnaireId: filters.questionnaireId } : {}), ...(search ? { search } : {}),
    ...(cursor ? { cursorDate: cursor.date, cursorId: cursor.id } : {}),
  };
  const queryKey = JSON.stringify(query), matching = data?.key === queryKey ? data.result : null;
  useEffect(() => {
    let alive = true;
    setLoading(true); setError(null);
    void api.list(JSON.parse(queryKey) as SmManagementQuery).then(result => {
      if (alive && currentOwner() === owner) setData({ key: queryKey, result });
    }).catch(failure => { if (alive) setError(errorText(failure)); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [api, owner, queryKey, reload, currentOwner]);
  const resetPage = () => { setCursor(null); setPrevious([]); };
  const changePeriod = (value: SmPlanningPeriod) => { setPeriod(value); resetPage(); };
  const facetOptions = (key: "smUserId" | "marketId" | "questionnaireId", name: "smName" | "marketName" | "questionnaireName", all: string) => {
    const values = new Map((data?.result.facets ?? []).map(facet => [facet[key], facet[name]]));
    return [{ value: "all", label: all }, ...Array.from(values, ([value, label]) => ({ value, label }))];
  };
  return <div className={styles.workspace}>
    <AdminFilterControlStyles />
    <section className={styles.panel} aria-label="Abgeschlossene SM-Fragebögen">
      <div className={styles.intro}><div><p className={styles.eyebrow}>Shelf Merchandising</p><h2>Abgeschlossene Fragebögen</h2><p className={styles.hint}>Antworten ansehen, nachvollziehbar korrigieren und den Verlauf prüfen.</p></div>
        <button className={styles.iconButton} disabled={loading} aria-label="Fragebögen aktualisieren" onClick={() => setReload(value => value + 1)}><RefreshCw size={14} /></button></div>
      <div className={styles.filters}>
        <div className={styles.field}><span>Besuchszeitraum</span><div style={{ display: "flex", gap: 5 }}><button className={styles.iconButton} aria-label="Vorheriger Zeitraum" onClick={() => changePeriod(shiftSmPeriod(period, -1))}><ChevronLeft size={13} /></button><SmPlanningPeriodPicker value={period} onChange={changePeriod} /><button className={styles.iconButton} aria-label="Nächster Zeitraum" onClick={() => changePeriod(shiftSmPeriod(period, 1))}><ChevronRight size={13} /></button></div></div>
        {([ ["smUserId", "smName", "Shelf Merchandiser", "Alle SMs"], ["marketId", "marketName", "Markt", "Alle Märkte"], ["questionnaireId", "questionnaireName", "Fragebogen", "Alle Fragebögen"] ] as const).map(([key, name, label, all]) => <div className={styles.field} key={key}><span>{label}</span><AdminDropdown value={filters[key]} options={facetOptions(key, name, all)} ariaLabel={label} placeholder={all} searchable onChange={value => { setFilters(current => ({ ...current, [key]: value })); resetPage(); }} /></div>)}
        <label className={styles.field}>Suche<input type="search" value={filters.search} maxLength={200} placeholder="SM, Markt oder Adresse …" onChange={event => { setFilters(current => ({ ...current, search: event.target.value })); resetPage(); }} /></label>
      </div>
      {notice ? <p role="status" className={styles.notice}>{notice}</p> : null}
      {error ? <div role="alert" className={styles.error}>{error} <button className={styles.textButton} onClick={() => setReload(value => value + 1)}>Erneut laden</button></div> : null}
      {data?.result.facetsTruncated ? <p className={styles.hint} style={{ padding: "0 20px" }}>Viele Filteroptionen: Nutze die Suche oder einen kleineren Zeitraum, wenn ein Eintrag fehlt.</p> : null}
      {!matching && loading ? <SmManagementSkeleton /> : matching?.visits.length ? <div className={styles.tableWrap}><table className={styles.table}><thead><tr>{["Besuch", "Shelf Merchandiser", "Markt", "Fragebogen", "Start – Ende", ""].map((label, index) => <th key={index} scope="col">{label}</th>)}</tr></thead><tbody>
        {matching.visits.map(visit => <tr key={visit.id}><td className={styles.time}>{dateLabel(visit.workDate)}</td><td>{visit.smName}</td><td>{visit.marketName}<small>{visit.address}</small></td><td>{visit.questionnaireName}<small>Version {visit.questionnaireVersion} · {visit.answeredCount} Antworten</small></td><td className={styles.time}>{smManagementTime(visit.startedAt)} – {smManagementTime(visit.completedAt)}</td><td><button className={styles.iconButton} aria-label={`Fragebogen von ${visit.smName} in ${visit.marketName} öffnen`} onClick={() => setSelected(visit.id)}><ChevronRight size={14} /></button></td></tr>)}
      </tbody></table></div> : !error && !loading ? <div className={styles.empty}><ClipboardCheck size={26} strokeWidth={1.4} /><strong>{search || Object.values(filters).some(value => value !== "all" && value !== "") ? "Keine Treffer für diese Filter" : "Noch keine abgeschlossenen Fragebögen"}</strong><span>Wähle einen anderen Zeitraum oder passe die Filter an.</span></div> : null}
      <div className={styles.pagination}><span className={styles.hint}>{matching?.visits.length ?? 0} Fragebögen auf dieser Seite</span><div className={styles.actions}>
        <button className={styles.secondary} disabled={loading || previous.length === 0} onClick={() => { setCursor(previous.at(-1) ?? null); setPrevious(values => values.slice(0, -1)); }}>Zurück</button>
        <button className={styles.secondary} disabled={loading || !matching?.nextCursor} onClick={() => { if (matching?.nextCursor) { setPrevious(values => [...values, cursor]); setCursor(matching.nextCursor); } }}>Weiter</button>
      </div></div>
    </section>
    {selected ? <SmManagementDrawer key={selected} id={selected} api={api} onClose={closeSelected} onSaved={refreshAfterSave} /> : null}
  </div>;
}

function SmManagementDrawer({ id, api, onClose, onSaved }: { id: string; api: SmManagementApi; onClose: () => void; onSaved: () => void }) {
  const [detail, setDetail] = useState<SmManagementDetail | null>(null), [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true), [editing, setEditing] = useState(false), [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<Record<string, SmVisitAnswer>>({}), [reason, setReason] = useState("");
  const [uploads, setUploads] = useState<Array<{ receipt: SmAdminPhotoReceipt; preview: string }>>([]);
  const [uploading, setUploading] = useState(false), [saved, setSaved] = useState(false), [needsReload, setNeedsReload] = useState(false);
  const [confirm, setConfirm] = useState<"close" | "cancel" | "reload" | null>(null), [uncertain, setUncertain] = useState(false);
  const pending = useRef<SmAdminCorrection | null>(null), dialog = useRef<HTMLDivElement>(null), alive = useRef(true), sequence = useRef(0);
  const previews = useRef<string[]>([]);
  const questions = useMemo(() => detail?.sections.flatMap(section => section.questions) ?? [], [detail]);
  const hidden = useMemo(() => smManagementHidden(questions, draft), [questions, draft]);
  const changes = questions.filter(question => !hidden.has(question.id) && draft[question.id] && JSON.stringify(draft[question.id]) !== JSON.stringify(question.answer)).map(question => ({ questionId: question.id, answer: draft[question.id] }));
  const dirty = editing && (Object.keys(draft).length > 0 || reason.trim().length > 0 || uploads.length > 0);
  const dirtyRef = useRef(false); dirtyRef.current = dirty;
  const busyRef = useRef(false); busyRef.current = busy || uploading;
  const clearDraft = () => { setDraft({}); setReason(""); setUploads([]); pending.current = null; setUncertain(false); previews.current.forEach(URL.revokeObjectURL); previews.current = []; };
  const load = useCallback(async () => {
    const request = ++sequence.current; setLoading(true);
    try { const result = await api.detail(id); if (alive.current && request === sequence.current) { setDetail(result); setNeedsReload(false); setError(null); } }
    catch (failure) { if (alive.current && request === sequence.current) setError(errorText(failure)); }
    finally { if (alive.current && request === sequence.current) setLoading(false); }
  }, [api, id]);
  useEffect(() => {
    alive.current = true; void load();
    return () => { alive.current = false; sequence.current++; previews.current.forEach(URL.revokeObjectURL); };
  }, [load]);
  const close = useCallback(() => { if (busyRef.current) return; if (dirtyRef.current) setConfirm("close"); else onClose(); }, [onClose]);
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null, oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden"; dialog.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); close(); }
      if (event.key !== "Tab") return;
      const controls = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled):not([type="hidden"]),textarea:not(:disabled),a[href],[tabindex="0"]') ?? []).filter(element => element.getClientRects().length > 0);
      const first = controls[0], last = controls.at(-1);
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    const beforeUnload = (event: BeforeUnloadEvent) => { if (dirtyRef.current || busyRef.current) { event.preventDefault(); event.returnValue = ""; } };
    document.addEventListener("keydown", keydown); window.addEventListener("beforeunload", beforeUnload);
    return () => { document.body.style.overflow = oldOverflow; previousFocus?.focus(); document.removeEventListener("keydown", keydown); window.removeEventListener("beforeunload", beforeUnload); };
  }, [close]);
  const save = async () => {
    if (!detail || busy || uploading) return;
    if (!pending.current) {
      if (reason.trim().length < 3 || !changes.length) { setError("Bitte gib einen Änderungsgrund ein und ändere mindestens eine Antwort."); return; }
      const missing = questions.filter(question => !hidden.has(question.id) && !smManagementAnswerComplete(question, draft[question.id] ?? question.answer));
      if (missing.length) { setError("Bitte ergänze alle sichtbaren Pflichtantworten und Kommentare."); document.getElementById(`sm-management-question-${missing[0].id}`)?.scrollIntoView({ block: "center", behavior: "smooth" }); return; }
      pending.current = { expectedVersion: detail.version, clientMutationToken: crypto.randomUUID(), reason: reason.trim(), changes,
        uploads: uploads.filter(upload => changes.some(change => change.questionId === upload.receipt.questionId && change.answer.kind === "photo" && change.answer.fileIds.includes(upload.receipt.id))).map(upload => upload.receipt) };
    }
    setBusy(true); setError(null);
    try {
      await api.correct(id, pending.current);
      if (!alive.current) return;
      setSaved(true); setEditing(false); setNeedsReload(true); clearDraft(); onSaved(); await load();
    } catch (failure) {
      if (!alive.current) return;
      const definite = failure instanceof BackendApiError && failure.status >= 400 && failure.status < 500;
      if (definite) { pending.current = null; setUncertain(false); }
      else setUncertain(true);
      setError(errorText(failure));
    } finally { if (alive.current) setBusy(false); }
  };
  const upload = async (question: SmManagedQuestion, chosen: File[]) => {
    if (busy || uploading || uncertain) return;
    const previous = draft[question.id] ?? question.answer, ids = previous.kind === "photo" ? [...previous.fileIds] : [];
    if (ids.length + chosen.length > 20 || uploads.length + chosen.length > 40) { setError("Maximal 20 Fotos pro Frage und 40 neue Fotos pro Korrektur."); return; }
    setUploading(true); setError(null);
    try {
      for (const file of chosen) {
        const receipt = await api.upload(id, question.id, file);
        if (!alive.current) return;
        const preview = URL.createObjectURL(file); previews.current.push(preview); ids.push(receipt.id);
        setUploads(current => [...current, { receipt, preview }]);
        setDraft(current => ({ ...current, [question.id]: { kind: "photo", fileIds: [...ids], ...(previous.comment ? { comment: previous.comment } : {}) } }));
      }
    } catch (failure) { if (alive.current) setError(errorText(failure)); }
    finally { if (alive.current) setUploading(false); }
  };
  const runConfirm = () => { const action = confirm; setConfirm(null); clearDraft(); setEditing(false); setError(null); if (action === "close") onClose(); else if (action === "reload") void load(); };
  const visit = detail?.visit;
  return createPortal(<div className={styles.backdrop} onClick={event => { if (event.target === event.currentTarget) close(); }}>
    <div ref={dialog} className={styles.drawer} role="dialog" aria-modal="true" aria-labelledby="sm-management-title" tabIndex={-1}>
      <header className={styles.drawerHeader}><div className={styles.headerLine}><div><p className={styles.eyebrow}>Fragebogen · {editing ? "Korrektur" : "Abgeschlossen"}</p><h2 id="sm-management-title">{visit?.marketName ?? "Fragebogen laden"}</h2><p className={styles.hint}>{visit?.address}</p></div><button className={styles.iconButton} aria-label="Fragebogen schließen" disabled={busy || uploading} onClick={close}><X size={15} /></button></div>
        {visit ? <div className={styles.meta}><div><small>SM</small><span>{visit.smName}</span></div><div><small>Besuch</small><span>{visit.startedAt ? dateLabel(visit.startedAt) : "Datum nicht erfasst"}</span></div><div><small>Start – Ende</small><span className={styles.time}>{smManagementTime(visit.startedAt)} – {smManagementTime(visit.completedAt)}</span></div><div><small>Fragebogen</small><span>{visit.questionnaireName} · V{visit.questionnaireVersion}</span></div></div> : null}
      </header>
      <div className={styles.drawerContent}>
        {saved ? <p className={styles.notice} role="status"><Check size={13} /> Korrektur gespeichert. Original und Besuchszeiten bleiben erhalten.</p> : null}
        {error ? <div className={styles.error} role="alert">{error}{uncertain ? <p>Der Ausgang ist noch unklar. „Speichern prüfen“ verwendet dieselbe Speicher-ID und erzeugt keine doppelte Korrektur.</p> : <button className={styles.textButton} disabled={busy || uploading} onClick={() => dirty ? setConfirm("reload") : void load()}>Aktuellen Stand neu laden</button>}</div> : null}
        {!detail && loading ? <SmManagementSkeleton detail /> : detail?.sections.map(section => <section key={section.id}><h3 className={styles.sectionTitle}>{section.title}</h3>{section.description ? <p className={styles.hint}>{section.description}</p> : null}
          {section.questions.map(question => {
            const value = draft[question.id] ?? question.answer, isHidden = hidden.has(question.id);
            const invalid = editing && !isHidden && !smManagementAnswerComplete(question, value);
            const photos: SmManagementPhoto[] = [...question.photos, ...uploads.filter(item => item.receipt.questionId === question.id).map(item => ({ id: item.receipt.id, fileName: item.receipt.originalFileName, signedUrl: item.preview }))];
            return <article id={`sm-management-question-${question.id}`} key={question.id} className={`${styles.question} ${invalid ? styles.questionInvalid : ""}`}>
              <div className={styles.questionHeader}><div><h3>{question.text}{question.required ? <span className={styles.required}> *</span> : null}</h3>{typeof question.config.subheading === "string" && question.config.subheading ? <span className={styles.subheading}>{question.config.subheading}</span> : null}</div></div>
              {isHidden ? <p className={styles.hint}>Durch Fragebogenlogik ausgeblendet. Frühere Antworten bleiben im Verlauf.</p> : <SmManagementAnswer question={question} value={value} editable={editing} disabled={busy || uploading || uncertain} photos={photos} onChange={answer => { setDraft(current => ({ ...current, [question.id]: answer })); setSaved(false); }} onUpload={chosen => void upload(question, chosen)} />}
              {invalid ? <p className={styles.hint} style={{ color: "#c22" }}>Pflichtantwort oder Kommentar fehlt.</p> : null}
              <QuestionHistory key={`${question.id}:${detail.version}`} api={api} submissionId={id} question={question} />
            </article>;
          })}
        </section>)}
      </div>
      <footer className={styles.footer}>
        {confirm ? <div className={styles.confirm} role="alert">{uncertain ? "Das Speichern könnte bereits abgeschlossen sein. Schließen bricht die Server-Anfrage nicht ab. Beim Wiederöffnen wird der aktuelle Stand geladen." : "Ungespeicherte Änderungen verwerfen?"}<div className={styles.actions}><button className={styles.secondary} onClick={() => setConfirm(null)}>{uncertain ? "Zurück zur Prüfung" : "Weiter bearbeiten"}</button><button className={styles.secondary} onClick={runConfirm}>{uncertain ? "Ansicht trotzdem schließen" : "Verwerfen"}</button></div></div> : null}
        {editing ? <><label className={styles.field}>Änderungsgrund · nicht der Antwortkommentar<textarea aria-label="Änderungsgrund" rows={2} maxLength={2000} disabled={busy || uploading || uncertain} value={reason} onChange={event => setReason(event.target.value)} placeholder="Warum wird die Antwort korrigiert?" /></label><div className={styles.actions}>
          <button className={styles.secondary} disabled={busy || uploading || uncertain} onClick={() => dirty ? setConfirm("cancel") : setEditing(false)}>Abbrechen</button>
          <button className={styles.primary} disabled={busy || uploading || (!uncertain && (!changes.length || reason.trim().length < 3))} onClick={() => void save()}>{busy || uploading ? <LoaderCircle size={13} className="animate-spin" /> : <Check size={13} />}{uploading ? "Fotos laden …" : uncertain ? "Speichern prüfen" : "Korrektur speichern"}</button>
        </div></> : <div className={styles.actions}><span className={styles.hint}>Originaldaten bleiben im Verlauf erhalten.</span><button className={styles.primary} disabled={!detail || loading || needsReload} onClick={() => { setEditing(true); setSaved(false); setError(null); }}><Pencil size={12} />Antworten bearbeiten</button></div>}
      </footer>
    </div>
  </div>, document.body);
}

function QuestionHistory({ api, submissionId, question }: { api: SmManagementApi; submissionId: string; question: SmManagedQuestion }) {
  const [open, setOpen] = useState(false), [data, setData] = useState<SmManagementHistory | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const alive = useRef(true); useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const load = async (cursor?: number) => {
    if (busy) return; setBusy(true); setError(null);
    try { const result = await api.history(submissionId, question.id, cursor); if (alive.current) setData(previous => ({ ...result, entries: cursor ? [...previous?.entries ?? [], ...result.entries] : result.entries })); }
    catch (failure) { if (alive.current) setError(errorText(failure)); }
    finally { if (alive.current) setBusy(false); }
  };
  return <div className={styles.history}><button className={styles.textButton} aria-expanded={open} onClick={() => { setOpen(value => !value); if (!data && !busy) void load(); }}><History size={12} />{open ? "Verlauf schließen" : "Änderungsverlauf"}</button>
    {open ? <div>{busy && !data ? <span className={styles.hint}>Verlauf wird geladen …</span> : null}{error ? <p role="alert" className={styles.hint}>{error} <button className={styles.textButton} onClick={() => void load()}>Erneut laden</button></p> : null}
      {data?.entries.map(entry => <div key={entry.id} className={styles.historyItem}><strong>Version {entry.version}{entry.current ? " · Aktuell" : ""} · {entry.actor} · {dateLabel(entry.at)} {smManagementTime(entry.at)}</strong><p>{smManagementAnswerLabel(question, entry.value)}</p>{entry.value.comment ? <p>Kommentar: {entry.value.comment}</p> : null}{entry.reason ? <p>Grund: {entry.reason}</p> : null}<SmManagementPhotos photos={entry.photos} /></div>)}
      {data && !data.entries.length ? <p className={styles.hint}>Noch keine gespeicherte Antwort.</p> : null}{data?.nextCursor ? <button className={styles.textButton} disabled={busy} onClick={() => void load(data.nextCursor!)}>Ältere Versionen laden</button> : null}</div> : null}
  </div>;
}
