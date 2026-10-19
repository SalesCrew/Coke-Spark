"use client";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type DragEvent,
} from "react";
import {
  Archive,
  ArrowLeft,
  BookOpen,
  Check,
  ChevronRight,
  FilePlus2,
  FileText,
  LoaderCircle,
  RotateCcw,
  Search,
  Upload,
  X,
} from "lucide-react";
import {
  BackendApiError,
  requestGmBriefings,
  uploadGmBriefingPdf,
  getAuthPrincipalKey,
  readAuthSession,
} from "@/lib/api/backend";
import { subscribeToAuthSessionChanges } from "@/lib/auth/sessionRegistry";
import { useAdminAccess } from "@/context/AdminAccessContext";
import {
  AdminDatePicker,
  AdminFilterControlStyles,
} from "@/components/admin/AdminFilterControls";
import { PdfPage, useBriefingPdf } from "@/components/gm/briefings/PdfPage";
import type { BriefingDraft, BriefingPublication } from "@/types/gmBriefings";
import styles from "./briefing-editor.module.css";
const path = "/admin/gm-briefings";
function date(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString("de-AT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
function publicationState(item: BriefingDraft) {
  if (item.archivedAt) return "Archiviert";
  const latest = item.publications?.[0];
  if (!latest) return "Entwurf";
  const today = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Vienna",
  }).format(new Date());
  if (latest.visibleFrom > today) return "Geplant";
  if (latest.visibleUntil && latest.visibleUntil < today) return "Abgelaufen";
  return "Veröffentlicht";
}
export function BriefingWorkspace() {
  const router = useRouter();
  const { canWrite, canUpdate } = useAdminAccess(),
    write = canWrite("wochenschwerpunkte"),
    update = canUpdate("wochenschwerpunkte");
  const [items, setItems] = useState<BriefingDraft[]>([]),
    [draft, setDraft] = useState<BriefingDraft | null>(null),
    [savedSignature, setSavedSignature] = useState(""),
    [query, setQuery] = useState(""),
    [tab, setTab] = useState<"current" | "archive">("current");
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [conflict, setConflict] = useState(false),
    [notice, setNotice] = useState(""),
    [dragging, setDragging] = useState(false),
    [page, setPage] = useState(1),
    [url, setUrl] = useState<string | null>(null),
    [previewError, setPreviewError] = useState(""),
    [previewAttempt, setPreviewAttempt] = useState(0);
  const [confirm, setConfirm] = useState<{
      title: string;
      text: string;
      action: () => void;
      label: string;
    } | null>(null),
    [history, setHistory] = useState(false);
  const input = useRef<HTMLInputElement>(null),
    replacement = useRef(false),
    owner = useRef(getAuthPrincipalKey(readAuthSession())),
    requestVersion = useRef(0),
    dropDepth = useRef(0),
    uploadAttempt = useRef<{ key: string; operationId: string } | null>(null),
    noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { pdf, error: pdfError } = useBriefingPdf(url);
  const signature = (value: BriefingDraft) =>
    JSON.stringify({
      title: value.title,
      description: value.description,
      visibleFrom: value.visibleFrom,
      visibleUntil: value.visibleUntil,
      pages: value.pages,
    });
  const dirty = !!draft && signature(draft) !== savedSignature;
  const isCurrent = () =>
    owner.current === getAuthPrincipalKey(readAuthSession());
  const load = useCallback(async () => {
    const n = ++requestVersion.current;
    const principal = owner.current;
    try {
      const data = await requestGmBriefings<{ items: BriefingDraft[] }>(path);
      if (n === requestVersion.current && principal === owner.current) {
        setItems(data.items);
        setError("");
      }
    } catch (e) {
      if (n === requestVersion.current && principal === owner.current)
        setError((e as Error).message);
    } finally {
      if (n === requestVersion.current && principal === owner.current)
        setLoading(false);
    }
  }, []);
  useEffect(() => {
    const requests = requestVersion;
    void load();
    const unsubscribe = subscribeToAuthSessionChanges(() => {
      const next = getAuthPrincipalKey(readAuthSession());
      if (next !== owner.current) {
        owner.current = next;
        ++requestVersion.current;
        setItems([]);
        setBusy("");
        setDraft(null);
        setUrl(null);
        setConfirm(null);
        setError("");
        setNotice("");
        void load();
      }
    });
    return () => {
      ++requests.current;
      unsubscribe();
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    };
  }, [load]);
  useEffect(() => {
    if (!dirty) return;
    const prevent = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, [dirty]);
  useEffect(() => {
    if (!dirty) return;
    const intercept = (event: MouseEvent) => {
      const anchor =
        event.target instanceof Element
          ? event.target.closest<HTMLAnchorElement>("a[href]")
          : null;
      if (
        !anchor ||
        anchor.target ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const target = new URL(anchor.href, location.href);
      if (target.origin !== location.origin || target.href === location.href)
        return;
      event.preventDefault();
      event.stopPropagation();
      setConfirm({
        title: "Entwurf verlassen?",
        text: "Deine Änderungen wurden noch nicht gespeichert.",
        label: "Änderungen verwerfen",
        action: () =>
          router.push(target.pathname + target.search + target.hash),
      });
    };
    document.addEventListener("click", intercept, true);
    return () => document.removeEventListener("click", intercept, true);
  }, [dirty, router]);
  useEffect(() => {
    let cancelled = false;
    setUrl(null);
    setPreviewError("");
    if (!draft) return;
    void requestGmBriefings<{ url: string }>(`${path}/${draft.id}/preview`)
      .then((data) => {
        if (!cancelled) setUrl(data.url);
      })
      .catch((e) => {
        if (!cancelled) setPreviewError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [draft?.id, draft?.file.path, previewAttempt]); // eslint-disable-line react-hooks/exhaustive-deps
  function toast(message: string) {
    setNotice(message);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(""), 4500);
  }
  function select(item: BriefingDraft) {
    const action = () => {
      setDraft(structuredClone(item));
      setSavedSignature(signature(item));
      setPage(1);
      setError("");
      setHistory(false);
    };
    if (dirty)
      setConfirm({
        title: "Entwurf verlassen?",
        text: "Deine Änderungen wurden noch nicht gespeichert.",
        label: "Änderungen verwerfen",
        action,
      });
    else action();
  }
  function change(fields: Partial<BriefingDraft>) {
    setDraft((value) => (value ? { ...value, ...fields } : value));
    setNotice("");
  }
  function changePage(fields: Partial<BriefingDraft["pages"][number]>) {
    if (!draft) return;
    change({
      pages: draft.pages.map((p) =>
        p.pageNumber === page ? { ...p, ...fields } : p,
      ),
    });
  }
  async function act(label: string, action: () => Promise<void>) {
    if (busy) return;
    const initiatingOwner = owner.current;
    setBusy(label);
    setError("");
    setConflict(false);
    try {
      await action();
    } catch (e) {
      if (owner.current === initiatingOwner) {
        setError((e as Error).message);
        setConflict(e instanceof BackendApiError && e.status === 409);
      }
    } finally {
      if (owner.current === initiatingOwner) setBusy("");
    }
  }
  function chooseFile(replace: boolean) {
    replacement.current = replace;
    input.current?.click();
  }
  async function upload(file: File, replace: boolean) {
    if (
      !file.name.toLowerCase().endsWith(".pdf") ||
      (file.type && file.type !== "application/pdf")
    ) {
      setError("Bitte eine PDF-Datei wählen.");
      return;
    }
    if (file.size > 25 * 1024 * 1024 || !file.size) {
      setError("Bitte eine PDF mit maximal 25 MB wählen.");
      return;
    }
    await act("PDF wird aufgeteilt …", async () => {
      const key = `${owner.current}:${file.name}:${file.size}:${file.lastModified}:${replace ? draft?.id : "new"}:${replace ? draft?.draftRevision : ""}`;
      if (uploadAttempt.current?.key !== key)
        uploadAttempt.current = { key, operationId: crypto.randomUUID() };
      const row = await uploadGmBriefingPdf(
        file,
        uploadAttempt.current.operationId,
        replace && draft
          ? { id: draft.id, revision: draft.draftRevision }
          : undefined,
      );
      if (!isCurrent()) return;
      uploadAttempt.current = null;
      const next = {
        ...row,
        publications: replace ? (draft?.publications ?? []) : [],
      };
      setDraft(next);
      setSavedSignature(signature(next));
      setPage(1);
      setTab("current");
      await load();
      toast(
        `${row.file.pageCount} ${row.file.pageCount === 1 ? "Seite bereit" : "Seiten bereit"}`,
      );
    });
  }
  function receive(files: FileList | File[]) {
    const list = Array.from(files);
    if (list.length !== 1) {
      setError("Bitte jeweils eine PDF hochladen.");
      return;
    }
    const file = list[0]!;
    const replace = replacement.current && !!draft;
    const action = () => void upload(file, replace);
    if (dirty || replace)
      setConfirm({
        title: replace ? "PDF ersetzen?" : "Neuen Entwurf öffnen?",
        text: replace
          ? "Die veröffentlichte Version bleibt erhalten. Seitentexte bleiben ihrer Seitennummer zugeordnet. Ungespeicherte Änderungen werden verworfen."
          : "Deine ungespeicherten Änderungen werden verworfen.",
        label: replace ? "PDF ersetzen" : "Neuen Entwurf öffnen",
        action,
      });
    else action();
  }
  async function save(current: BriefingDraft) {
    const row = await requestGmBriefings<BriefingDraft>(
      `${path}/${current.id}`,
      {
        expectedRevision: current.draftRevision,
        title: current.title,
        description: current.description,
        visibleFrom: current.visibleFrom,
        visibleUntil: current.visibleUntil,
        pages: current.pages,
      },
      "PATCH",
    );
    if (!isCurrent()) throw new Error("Zugang geändert.");
    const next = { ...row, publications: current.publications ?? [] };
    setDraft(next);
    setSavedSignature(signature(next));
    return next;
  }
  const filtered = items.filter(
    (item) =>
      Boolean(item.archivedAt) === (tab === "archive") &&
      `${item.title} ${item.description} ${item.file.name}`
        .toLocaleLowerCase("de")
        .includes(query.toLocaleLowerCase("de")),
  );
  const selectedPage = draft?.pages[page - 1],
    published = draft?.publications?.[0],
    unpublished =
      !!draft &&
      (dirty || published?.sourceDraftRevision !== draft.draftRevision);
  const valid =
    !!draft?.title.trim() &&
    (!draft.visibleFrom ||
      !draft.visibleUntil ||
      draft.visibleUntil >= draft.visibleFrom);
  function drop(event: DragEvent) {
    event.preventDefault();
    dropDepth.current = 0;
    setDragging(false);
    if (!write || busy) return;
    replacement.current = false;
    receive(event.dataTransfer.files);
  }
  return (
    <div
      className={styles.workspace}
      onDragEnter={(event) => {
        if (!event.dataTransfer.types.includes("Files")) return;
        event.preventDefault();
        ++dropDepth.current;
        if (write && !busy) setDragging(true);
      }}
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes("Files")) event.preventDefault();
      }}
      onDragLeave={() => {
        if (--dropDepth.current <= 0) setDragging(false);
      }}
      onDrop={drop}
    >
      <AdminFilterControlStyles />
      <input
        ref={input}
        type="file"
        accept="application/pdf,.pdf"
        hidden
        onChange={(event) => {
          if (event.target.files?.length) receive(event.target.files);
          event.target.value = "";
        }}
      />
      <aside className={styles.library}>
        <div className={styles.libraryTop}>
          <div>
            <h2>Dokumente</h2>
            <span>
              {items.filter((item) => !item.archivedAt).length} im
              Arbeitsbereich
            </span>
          </div>
          <button
            type="button"
            className={styles.newButton}
            disabled={!write || !!busy}
            aria-label="PDF hinzufügen"
            title="PDF hinzufügen"
            onClick={() => chooseFile(false)}
          >
            <FilePlus2 size={17} />
          </button>
        </div>
        <div className={styles.search}>
          <Search size={13} />
          <input
            aria-label="Dokumente suchen"
            placeholder="Suchen …"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className={styles.tabs}>
          <button
            aria-pressed={tab === "current"}
            onClick={() => setTab("current")}
          >
            Aktuell
          </button>
          <button
            aria-pressed={tab === "archive"}
            onClick={() => setTab("archive")}
          >
            Archiv
          </button>
        </div>
        <div className={styles.documentList}>
          {loading ? (
            <div className={styles.listMessage}>
              <LoaderCircle className={styles.spinner} size={17} />
              Dokumente laden …
            </div>
          ) : filtered.length ? (
            filtered.map((item) => (
              <button
                type="button"
                key={item.id}
                className={styles.document}
                title={item.title}
                aria-current={draft?.id === item.id}
                disabled={!!busy}
                onClick={() => select(item)}
              >
                <FileText size={16} />
                <div>
                  <strong>{item.title}</strong>
                  <span>
                    {publicationState(item)} · {item.file.pageCount} Seiten
                  </span>
                </div>
                <ChevronRight size={13} />
              </button>
            ))
          ) : (
            <p className={styles.listMessage}>
              {query
                ? "Keine Treffer"
                : tab === "archive"
                  ? "Noch nichts archiviert"
                  : "Noch keine Dokumente"}
            </p>
          )}
        </div>
        <div className={styles.libraryFoot}>
          <BookOpen size={14} />
          <span>Für Gebietsmanager</span>
        </div>
      </aside>
      <main className={styles.editor} aria-busy={!!busy}>
        {error && (
          <div role="alert" className={styles.error}>
            <span>{error}</span>
            {conflict && draft && (
              <button
                type="button"
                className={styles.conflictReload}
                onClick={() =>
                  setConfirm({
                    title: "Aktuellen Entwurf laden?",
                    text: "Deine ungespeicherten Änderungen werden durch den zuletzt gespeicherten Stand ersetzt.",
                    label: "Entwurf neu laden",
                    action: () =>
                      void act("Lädt …", async () => {
                        const data = await requestGmBriefings<{
                          items: BriefingDraft[];
                        }>(path);
                        if (!isCurrent()) return;
                        const current = data.items.find(
                          (item) => item.id === draft.id,
                        );
                        if (!current)
                          throw new Error("Dokument nicht mehr vorhanden.");
                        setItems(data.items);
                        setDraft(structuredClone(current));
                        setSavedSignature(signature(current));
                        setPage(1);
                      }),
                  })
                }
              >
                Entwurf neu laden
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setError("");
                if (!items.length) void load();
              }}
              aria-label="Meldung schließen"
            >
              <X size={14} />
            </button>
          </div>
        )}
        {!draft ? (
          <div className={styles.empty}>
            <div className={styles.emptyMark}>
              <FileText size={25} strokeWidth={1.4} />
            </div>
            <h2>Ein Dokument. Ein klarer Wochenfokus.</h2>
            <p>
              PDF hierher ziehen oder ein Dokument öffnen.
              <br />
              Die Seiten werden automatisch vorbereitet.
            </p>
            <button
              className={styles.primary}
              disabled={!write || !!busy}
              onClick={() => chooseFile(false)}
            >
              <Upload size={14} />
              PDF hinzufügen
            </button>
            <span>PDF · bis 25 MB · bis 80 Seiten</span>
          </div>
        ) : (
          <>
            <header className={styles.editorHeader}>
              <div className={styles.editorTitle}>
                <span
                  className={`${styles.statusPill} ${published && !draft.archivedAt ? styles.live : ""}`}
                >
                  {publicationState(draft)}
                </span>
                <h2>{draft.title || "Ohne Titel"}</h2>
                <span className={styles.fileName}>
                  {draft.file.name} ·{" "}
                  {draft.file.byteSize < 104858
                    ? `${Math.max(1, Math.round(draft.file.byteSize / 1024))} KB`
                    : `${(draft.file.byteSize / 1024 / 1024).toLocaleString("de-AT", { maximumFractionDigits: 1 })} MB`}
                </span>
              </div>
              <div className={styles.actions}>
                <span className={styles.saveState} aria-live="polite">
                  {busy ? (
                    <>
                      <LoaderCircle size={12} className={styles.spinner} />
                      {busy}
                    </>
                  ) : notice ? (
                    <>
                      <Check size={13} />
                      {notice}
                    </>
                  ) : dirty ? (
                    "Ungespeichert"
                  ) : (
                    "Gespeichert"
                  )}
                </span>
                <button
                  type="button"
                  className={styles.secondary}
                  disabled={!update || !dirty || !!busy || !valid}
                  onClick={() =>
                    void act("Speichert …", async () => {
                      await save(draft);
                      await load();
                      toast("Entwurf gespeichert");
                    })
                  }
                >
                  Speichern
                </button>
                <button
                  type="button"
                  className={styles.primary}
                  disabled={
                    !write ||
                    (dirty && !update) ||
                    !!busy ||
                    !valid ||
                    !!draft.archivedAt ||
                    !unpublished
                  }
                  onClick={() =>
                    setConfirm({
                      title: published
                        ? "Neue Version veröffentlichen?"
                        : "Für GMs veröffentlichen?",
                      text: `${draft.visibleFrom ? `Sichtbar ab ${date(draft.visibleFrom)}` : "Sofort sichtbar"}${draft.visibleUntil ? ` bis einschließlich ${date(draft.visibleUntil)}` : ", ohne Enddatum"}. ${published ? "GMs sehen ab dann diese Fassung und erhalten einen neuen Hinweis." : "Alle Gebietsmanager erhalten einen neuen Hinweis im Home-Menü."}`,
                      label: published
                        ? "Version veröffentlichen"
                        : "Veröffentlichen",
                      action: () =>
                        void act("Veröffentlicht …", async () => {
                          const current = dirty ? await save(draft) : draft;
                          const result =
                            await requestGmBriefings<BriefingPublication>(
                              `${path}/${current.id}/publish`,
                              {
                                expectedRevision: current.draftRevision,
                                operationId: crypto.randomUUID(),
                              },
                              "POST",
                            );
                          if (!isCurrent()) return;
                          const next = {
                            ...current,
                            publications: [
                              result,
                              ...(current.publications ?? []).filter(
                                (p) => p.id !== result.id,
                              ),
                            ],
                          };
                          setDraft(next);
                          await load();
                          toast("Veröffentlichung gespeichert");
                        }),
                    })
                  }
                >
                  {published ? "Neue Version" : "Veröffentlichen"}
                </button>
              </div>
            </header>
            <div className={styles.editorBody}>
              <nav className={styles.pageRail} aria-label="PDF-Seiten">
                {draft.pages.map((p) => (
                  <button
                    type="button"
                    key={p.pageNumber}
                    aria-current={page === p.pageNumber}
                    aria-label={`Seite ${p.pageNumber} bearbeiten`}
                    className={styles.thumbnail}
                    onClick={() => setPage(p.pageNumber)}
                  >
                    <div
                      style={{
                        aspectRatio: `${draft.file.dimensions[p.pageNumber - 1]?.width ?? 595}/${draft.file.dimensions[p.pageNumber - 1]?.height ?? 842}`,
                      }}
                    >
                      {Math.abs(p.pageNumber - page) <= 3 ? (
                        <PdfPage
                          pdf={pdf}
                          pageNumber={p.pageNumber}
                          thumbnail
                        />
                      ) : (
                        <div className={styles.thumbnailPlaceholder}>
                          <FileText size={15} />
                        </div>
                      )}
                    </div>
                    <span>{String(p.pageNumber).padStart(2, "0")}</span>
                  </button>
                ))}
              </nav>
              <div className={styles.preview}>
                <div className={styles.previewLabel}>
                  <span>
                    Seite {page} von {draft.file.pageCount}
                  </span>
                  <button
                    type="button"
                    disabled={!update || !!busy}
                    onClick={() => chooseFile(true)}
                  >
                    <RotateCcw size={12} />
                    PDF ersetzen
                  </button>
                </div>
                {previewError || pdfError ? (
                  <div className={styles.previewFailure}>
                    <p>Die PDF konnte nicht geladen werden.</p>
                    <button
                      onClick={() => setPreviewAttempt((value) => value + 1)}
                    >
                      Erneut laden
                    </button>
                  </div>
                ) : (
                  <div className={styles.paper}>
                    <PdfPage
                      key={`${draft.file.path}:${page}`}
                      pdf={pdf}
                      pageNumber={page}
                    />
                  </div>
                )}
                {(selectedPage?.title || selectedPage?.description) && (
                  <div className={styles.pageCaption}>
                    {selectedPage.title && <h3>{selectedPage.title}</h3>}
                    {selectedPage.description && (
                      <p>{selectedPage.description}</p>
                    )}
                  </div>
                )}
              </div>
              <aside className={styles.inspector}>
                <section>
                  <div className={styles.sectionHeading}>
                    <h3>Dokument</h3>
                  </div>
                  <label>
                    Titel
                    <input
                      value={draft.title}
                      disabled={!update || !!busy}
                      maxLength={160}
                      onChange={(e) => change({ title: e.target.value })}
                      placeholder="Wochenschwerpunkte KW 43"
                    />
                  </label>
                  <label>
                    Einleitung <span>optional</span>
                    <textarea
                      value={draft.description}
                      disabled={!update || !!busy}
                      maxLength={2000}
                      rows={2}
                      onChange={(e) => change({ description: e.target.value })}
                      placeholder="Was diese Woche zählt …"
                    />
                  </label>
                </section>
                <section>
                  <h3>Sichtbarkeit</h3>
                  <fieldset
                    disabled={!update || !!busy}
                    className={styles.dateFields}
                  >
                    <label>
                      Von
                      <AdminDatePicker
                        value={draft.visibleFrom ?? ""}
                        onChange={(value) =>
                          change({ visibleFrom: value || null })
                        }
                        ariaLabel="Sichtbar ab"
                        {...(draft.visibleUntil
                          ? { maxDate: draft.visibleUntil }
                          : {})}
                      />
                    </label>
                    <label>
                      Bis
                      <AdminDatePicker
                        value={draft.visibleUntil ?? ""}
                        onChange={(value) =>
                          change({ visibleUntil: value || null })
                        }
                        ariaLabel="Sichtbar bis einschließlich"
                        {...(draft.visibleFrom
                          ? { minDate: draft.visibleFrom }
                          : {})}
                      />
                    </label>
                  </fieldset>
                  <div className={styles.dateShortcuts}>
                    <button
                      disabled={!update || !!busy}
                      onClick={() => change({ visibleFrom: null })}
                    >
                      Ab sofort{!draft.visibleFrom && <Check size={10} />}
                    </button>
                    <button
                      disabled={!update || !!busy}
                      onClick={() => change({ visibleUntil: null })}
                    >
                      Ohne Ende{!draft.visibleUntil && <Check size={10} />}
                    </button>
                  </div>
                </section>
                <section>
                  <div className={styles.sectionHeading}>
                    <h3>Seite {String(page).padStart(2, "0")}</h3>
                    <span>Zusatztext · optional</span>
                  </div>
                  <label>
                    Überschrift
                    <input
                      value={selectedPage?.title ?? ""}
                      disabled={!update || !!busy}
                      maxLength={160}
                      onChange={(e) => changePage({ title: e.target.value })}
                      placeholder="Eine kurze Einordnung"
                    />
                  </label>
                  <label>
                    Beschreibung
                    <textarea
                      value={selectedPage?.description ?? ""}
                      disabled={!update || !!busy}
                      maxLength={4000}
                      rows={5}
                      onChange={(e) =>
                        changePage({ description: e.target.value })
                      }
                      placeholder="Ergänzende Hinweise zu dieser Seite …"
                    />
                  </label>
                </section>
                <div className={styles.inspectorBottom}>
                  {published && (
                    <>
                      <button
                        className={styles.historyToggle}
                        type="button"
                        onClick={() => setHistory((value) => !value)}
                        aria-expanded={history}
                      >
                        Veröffentlichungen
                        <span>
                          {draft.publications?.length}
                          <ChevronRight
                            size={12}
                            style={{
                              transform: history ? "rotate(90deg)" : undefined,
                            }}
                          />
                        </span>
                      </button>
                      {history && (
                        <div className={styles.history}>
                          {draft.publications?.map((p) => (
                            <div key={p.id}>
                              <strong>Version {p.version}</strong>
                              <span>
                                {date(p.visibleFrom)}
                                {p.visibleUntil
                                  ? ` – ${date(p.visibleUntil)}`
                                  : " · ohne Ende"}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                  <button
                    type="button"
                    disabled={!update || !!busy || dirty}
                    title={
                      dirty ? "Bitte zuerst den Entwurf speichern" : undefined
                    }
                    className={styles.archive}
                    onClick={() =>
                      setConfirm({
                        title: draft.archivedAt
                          ? "Dokument wiederherstellen?"
                          : "Dokument archivieren?",
                        text: draft.archivedAt
                          ? "Die Veröffentlichung wird innerhalb ihres Zeitraums wieder sichtbar. Der Lesestatus bleibt erhalten."
                          : "Die PDF verschwindet sofort bei GMs. Veröffentlichungen und Lesestatus bleiben erhalten.",
                        label: draft.archivedAt
                          ? "Wiederherstellen"
                          : "Archivieren",
                        action: () =>
                          void act("Speichert …", async () => {
                            const row = await requestGmBriefings<BriefingDraft>(
                              `${path}/${draft.id}/archive`,
                              { archived: !draft.archivedAt },
                              "PATCH",
                            );
                            if (!isCurrent()) return;
                            setDraft({
                              ...row,
                              publications: draft.publications ?? [],
                            });
                            setTab(row.archivedAt ? "archive" : "current");
                            await load();
                            toast(
                              row.archivedAt
                                ? "Archiviert"
                                : "Wiederhergestellt",
                            );
                          }),
                      })
                    }
                  >
                    {draft.archivedAt ? (
                      <ArrowLeft size={13} />
                    ) : (
                      <Archive size={13} />
                    )}
                    {draft.archivedAt ? "Aus Archiv holen" : "Archivieren"}
                  </button>
                </div>
              </aside>
            </div>
          </>
        )}
      </main>
      {dragging && (
        <div className={styles.dropOverlay}>
          <Upload size={30} strokeWidth={1.5} />
          <strong>PDF loslassen</strong>
          <span>Ein neuer Entwurf wird vorbereitet</span>
        </div>
      )}
      {confirm && (
        <Confirmation
          title={confirm.title}
          text={confirm.text}
          label={confirm.label}
          onClose={() => setConfirm(null)}
          onConfirm={() => {
            const action = confirm.action;
            setConfirm(null);
            action();
          }}
        />
      )}
    </div>
  );
}
function Confirmation({
  title,
  text,
  label,
  onClose,
  onConfirm,
}: {
  title: string;
  text: string;
  label: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const node = ref.current;
    node?.showModal();
    return () => node?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={styles.confirm}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      aria-labelledby="briefing-confirm-title"
    >
      <h2 id="briefing-confirm-title">{title}</h2>
      <p>{text}</p>
      <footer>
        <button
          type="button"
          autoFocus
          className={styles.secondary}
          onClick={onClose}
        >
          Abbrechen
        </button>
        <button type="button" className={styles.primary} onClick={onConfirm}>
          {label}
        </button>
      </footer>
    </dialog>
  );
}
