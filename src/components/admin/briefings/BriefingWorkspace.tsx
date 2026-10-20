"use client";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type DragEvent,
} from "react";
import {
  Archive,
  ArrowLeft,
  Check,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  CalendarDays,
  History,
  Maximize,
  MoveHorizontal,
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
  const [settingsTab, setSettingsTab] = useState<"document" | "page">("document");
  const [introductionOpen, setIntroductionOpen] = useState(false);
  const [fitMode, setFitMode] = useState<"page" | "width">("page");
  const previewStage = useRef<HTMLDivElement>(null);
  const [previewSize, setPreviewSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const node = previewStage.current;
    if (!node) return;
    document.getElementById("briefing-editor-title")?.focus({ preventScroll: true });
    const observer = new ResizeObserver(([entry]) => {
      setPreviewSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [draft?.id]);
  useEffect(() => {
    document.querySelector<HTMLElement>('[data-briefing-page][aria-current="true"]')?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [page]);
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
      setNotice("");
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
      setHistory(false);
      setSettingsTab("document");
      setIntroductionOpen(!!item.description);
      setFitMode("page");
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
    if (file.size > 500 * 1024 * 1024 || !file.size) {
      setError("Bitte eine PDF mit maximal 500 MB wählen.");
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
      setQuery("");
      setIntroductionOpen(!!next.description);
      setSettingsTab("document");
      setFitMode("page");
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
  function backToDocuments() {
    const id = draft?.id;
    const action = () => {
      setDraft(null);
      setUrl(null);
      setError("");
      requestAnimationFrame(() => document.getElementById(`briefing-open-${id}`)?.focus());
    };
    if (dirty) setConfirm({
      title: "Entwurf verlassen?",
      text: "Deine Änderungen wurden noch nicht gespeichert.",
      label: "Änderungen verwerfen",
      action,
    });
    else action();
  }
  function publish() {
    if (!draft) return;
    setConfirm({
      title: published ? "Neue Version veröffentlichen?" : "Für GMs veröffentlichen?",
      text: `${draft.visibleFrom ? `Sichtbar ab ${date(draft.visibleFrom)}` : "Sofort sichtbar"}${draft.visibleUntil ? ` bis einschließlich ${date(draft.visibleUntil)}` : ", ohne Enddatum"}. ${published ? "GMs sehen ab dann diese Fassung und erhalten einen neuen Hinweis." : "Alle Gebietsmanager erhalten einen neuen Hinweis im Home-Menü."}`,
      label: published ? "Version veröffentlichen" : "Veröffentlichen",
      action: () => void act("Veröffentlicht …", async () => {
        const current = dirty ? await save(draft) : draft;
        const result = await requestGmBriefings<BriefingPublication>(`${path}/${current.id}/publish`, {
          expectedRevision: current.draftRevision,
          operationId: crypto.randomUUID(),
        }, "POST");
        if (!isCurrent()) return;
        setDraft({ ...current, publications: [result, ...(current.publications ?? []).filter((p) => p.id !== result.id)] });
        await load();
        toast("Veröffentlichung gespeichert");
      }),
    });
  }
  function archive() {
    if (!draft) return;
    setConfirm({
      title: draft.archivedAt ? "Dokument wiederherstellen?" : "Dokument archivieren?",
      text: draft.archivedAt
        ? "Die Veröffentlichung wird innerhalb ihres Zeitraums wieder sichtbar. Der Lesestatus bleibt erhalten."
        : "Die PDF verschwindet sofort bei GMs. Veröffentlichungen und Lesestatus bleiben erhalten.",
      label: draft.archivedAt ? "Wiederherstellen" : "Archivieren",
      action: () => void act("Speichert …", async () => {
        const row = await requestGmBriefings<BriefingDraft>(`${path}/${draft.id}/archive`, { archived: !draft.archivedAt }, "PATCH");
        if (!isCurrent()) return;
        setDraft({ ...row, publications: draft.publications ?? [] });
        setTab(row.archivedAt ? "archive" : "current");
        await load();
        toast(row.archivedAt ? "Archiviert" : "Wiederhergestellt");
      }),
    });
  }
  const dimensions = draft?.file.dimensions[page - 1];
  const ratio = dimensions ? dimensions.width / dimensions.height : 595 / 842;
  const fittedWidth = previewSize.width && previewSize.height
    ? Math.max(1, Math.min(previewSize.width, previewSize.height * ratio))
    : undefined;
  const count = items.filter((item) => Boolean(item.archivedAt) === (tab === "archive")).length;
  const saveFeedback = (
    <span className={styles.saveState} data-dirty={dirty || undefined} role="status">
      {busy ? <><LoaderCircle size={13} className={styles.spinner} />{busy}</>
        : notice ? <><Check size={13} />{notice}</>
        : dirty ? <><span className={styles.unsavedDot} />Ungespeichert</>
        : draft ? <><Check size={13} />Gespeichert</> : null}
    </span>
  );
  return (
    <div className={styles.workspace} data-editor={!!draft || undefined}
      onDragEnter={(event) => {
        if (!event.dataTransfer.types.includes("Files")) return;
        event.preventDefault();
        ++dropDepth.current;
        if (write && !busy) setDragging(true);
      }}
      onDragOver={(event) => { if (event.dataTransfer.types.includes("Files")) event.preventDefault(); }}
      onDragLeave={() => { if (--dropDepth.current <= 0) setDragging(false); }}
      onDrop={drop}
    >
      <AdminFilterControlStyles />
      <input ref={input} type="file" accept="application/pdf,.pdf" hidden
        onChange={(event) => {
          if (event.target.files?.length) receive(event.target.files);
          event.target.value = "";
        }}
      />
      {error && (
        <div role="alert" className={styles.error}>
          <span>{error}</span>
          {conflict && draft && <button type="button" className={styles.conflictReload}
            onClick={() => setConfirm({
              title: "Aktuellen Entwurf laden?",
              text: "Deine ungespeicherten Änderungen werden durch den zuletzt gespeicherten Stand ersetzt.",
              label: "Entwurf neu laden",
              action: () => void act("Lädt …", async () => {
                const data = await requestGmBriefings<{ items: BriefingDraft[] }>(path);
                if (!isCurrent()) return;
                const current = data.items.find((item) => item.id === draft.id);
                if (!current) throw new Error("Dokument nicht mehr vorhanden.");
                setItems(data.items);
                setDraft(structuredClone(current));
                setSavedSignature(signature(current));
                setPage(1);
              }),
            })}>Entwurf neu laden</button>}
          {!draft && <button type="button" className={styles.conflictReload} onClick={() => { setLoading(true); void load(); }}>Erneut laden</button>}
          {(items.length > 0 || draft) && <button type="button" className={styles.iconButton} onClick={() => setError("")} aria-label="Meldung schließen"><X size={14} /></button>}
        </div>
      )}
      {!draft ? (
        <section className={styles.library} aria-label="Wochenschwerpunkte verwalten" aria-busy={loading || !!busy}>
          <header className={styles.libraryHeader}>
            <div className={styles.collectionTitle}><h2>Dokumente</h2><span>{loading ? "…" : count}</span></div>
            <div className={styles.libraryActions}>{saveFeedback}
              <button type="button" className={styles.primary} disabled={!write || !!busy} onClick={() => chooseFile(false)}>
                {busy ? <LoaderCircle size={14} className={styles.spinner} /> : <Upload size={14} />}PDF hinzufügen
              </button>
            </div>
          </header>
          <div className={styles.collectionToolbar}>
            <div className={styles.collectionTabs} aria-label="Dokumentstatus">
              <button type="button" aria-pressed={tab === "current"} onClick={() => setTab("current")}>Aktuell</button>
              <button type="button" aria-pressed={tab === "archive"} onClick={() => setTab("archive")}><Archive size={12} />Archiv</button>
            </div>
            <div className={styles.search}><Search size={14} />
              <input aria-label="Dokumente suchen" placeholder="Dokument suchen …" value={query} onChange={(event) => setQuery(event.target.value)} />
              {query && <button type="button" aria-label="Suche zurücksetzen" className={styles.clearSearch} onClick={() => setQuery("")}><X size={12} /></button>}
            </div>
          </div>
          {loading ? <div className={styles.loading} role="status"><span className={styles.srOnly}>Dokumente laden …</span>{[1, 2, 3].map((n) => <div key={n} className={styles.skeletonRow} />)}</div>
            : error && !items.length ? <div className={styles.empty}><FileText size={25} strokeWidth={1.5} /><h3>Dokumente konnten nicht geladen werden</h3><p>Bitte versuche es erneut.</p></div>
            : filtered.length ? (
              <div className={styles.tableScroll}>
                <table className={styles.table}>
                  <thead><tr><th scope="col">Dokument</th><th scope="col">Status</th><th scope="col">Sichtbarkeit</th><th scope="col">Zuletzt veröffentlicht</th><th scope="col"><span className={styles.srOnly}>Öffnen</span></th></tr></thead>
                  <tbody>{filtered.map((item) => {
                    const latest = item.publications?.[0];
                    return <tr key={item.id} className={styles.documentRow} aria-disabled={!!busy || undefined}>
                      <td><button type="button" id={`briefing-open-${item.id}`} className={styles.documentButton} disabled={!!busy} onClick={() => select(item)}>
                        <span className={styles.fileMark}><FileText size={17} strokeWidth={1.7} /></span>
                        <span className={styles.documentIdentity}><strong>{item.title}</strong><span title={item.file.name}>{item.file.name.replace(/\.pdf$/i, "") === item.title ? fileSummary(item) : `${item.file.name} · ${fileSummary(item)}`}</span></span>
                      </button></td>
                      <td><Status item={item} />{latest && latest.sourceDraftRevision !== item.draftRevision && <span className={styles.draftNote}>Entwurf geändert</span>}</td>
                      <td><span className={styles.tableDate}>{visibility(latest ? latest.visibleFrom : item.visibleFrom, latest ? latest.visibleUntil : item.visibleUntil)}</span></td>
                      <td>{latest ? <><span className={styles.tableDate}>{new Intl.DateTimeFormat("de-AT", { timeZone: "Europe/Vienna", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(latest.publishedAt))}</span><span className={styles.versionNote}>Version {latest.version}</span></> : <span className={styles.muted}>—</span>}</td>
                      <td aria-hidden="true"><span className={styles.openButton}><ChevronRight size={15} /></span></td>
                    </tr>;
                  })}</tbody>
                </table>
              </div>
            ) : <div className={styles.empty}>
              {query ? <Search size={23} strokeWidth={1.5} /> : <FileText size={27} strokeWidth={1.4} />}
              <h3>{query ? "Keine Dokumente gefunden" : tab === "archive" ? "Noch keine archivierten Dokumente" : "Noch keine Wochenschwerpunkte"}</h3>
              <p>{query ? "Versuche einen anderen Suchbegriff." : tab === "archive" ? "Archivierte Dokumente bleiben hier erhalten." : "PDF hinzufügen oder hierher ziehen."}</p>
              {query ? <button type="button" className={styles.secondary} onClick={() => setQuery("")}>Suche zurücksetzen</button>
                : tab === "current" && <span className={styles.fileLimits}>PDF · bis 500 MB · bis 80 Seiten</span>}
            </div>}
          <footer className={styles.libraryFoot}><FileText size={12} /><span>PDF · bis 500 MB · bis 80 Seiten</span><span>Für Gebietsmanager</span></footer>
        </section>
      ) : (
        <>
          <header className={styles.editorHeader}>
            <button type="button" className={styles.backButton} onClick={backToDocuments} disabled={!!busy} aria-label="Alle Dokumente" title="Alle Dokumente"><ArrowLeft size={17} /></button>
            <div className={styles.editorTitle}>
              <div className={styles.identityLine}><h2 id="briefing-editor-title" tabIndex={-1} title={draft.title}>{draft.title || "Ohne Titel"}</h2><Status item={draft} /></div>
              <div className={styles.fileMeta}><span title={draft.file.name}>{draft.file.name}</span><span>{fileSummary(draft)}</span>{published && unpublished && <span className={styles.draftNote}>Entwurf geändert</span>}</div>
            </div>
            <div className={styles.actions}>{saveFeedback}
              <button type="button" className={styles.secondary} disabled={!update || !dirty || !!busy || !valid} onClick={() => void act("Speichert …", async () => { await save(draft); await load(); toast("Entwurf gespeichert"); })}>Speichern</button>
              <button type="button" className={styles.primary} disabled={!write || (dirty && !update) || !!busy || !valid || !!draft.archivedAt || !unpublished} onClick={publish}>{published ? "Neue Version veröffentlichen" : "Veröffentlichen"}</button>
            </div>
          </header>
          <div className={styles.editorBody}>
            <aside className={styles.settings} aria-label="Dokument bearbeiten">
              <div className={styles.settingsTabs} role="tablist" aria-label="Einstellungen" onKeyDown={(event) => {
                if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
                event.preventDefault();
                const next = event.key === "Home" ? "document" : event.key === "End" ? "page" : settingsTab === "document" ? "page" : "document";
                setSettingsTab(next);
                document.getElementById(`briefing-tab-${next}`)?.focus();
              }}>
                <button type="button" id="briefing-tab-document" role="tab" aria-selected={settingsTab === "document"} aria-controls="briefing-settings-document" tabIndex={settingsTab === "document" ? 0 : -1} onClick={() => setSettingsTab("document")}>Dokument</button>
                <button type="button" id="briefing-tab-page" role="tab" aria-selected={settingsTab === "page"} aria-controls="briefing-settings-page" tabIndex={settingsTab === "page" ? 0 : -1} onClick={() => setSettingsTab("page")}>Seitentext{selectedPage && (selectedPage.title || selectedPage.description) && <span className={styles.contentDot} />}</button>
              </div>
              <div className={styles.settingsScroll}>
                {settingsTab === "document" ? <div role="tabpanel" id="briefing-settings-document" aria-labelledby="briefing-tab-document" className={styles.settingsPanel}>
                  <section className={styles.formSection}>
                    <label className={styles.field}>Titel<input value={draft.title} disabled={!update || !!busy} maxLength={160} onChange={(event) => change({ title: event.target.value })} placeholder="Wochenschwerpunkte KW 43" /></label>
                    {!draft.title.trim() && <p className={styles.fieldError}>Bitte einen Titel eingeben.</p>}
                    <details className={styles.introduction} key={draft.id} open={introductionOpen} onToggle={(event) => setIntroductionOpen(event.currentTarget.open)}>
                      <summary><span>Einleitung <span className={styles.optional}>optional</span></span><ChevronDown size={13} /></summary>
                      <label className={styles.srOnly} htmlFor="briefing-introduction">Einleitung</label>
                      <textarea id="briefing-introduction" value={draft.description} disabled={!update || !!busy} maxLength={2000} rows={3} onChange={(event) => change({ description: event.target.value })} placeholder="Kurze Einordnung für die GMs …" />
                    </details>
                  </section>
                  <section className={styles.formSection}>
                    <h3>Sichtbarkeit</h3>
                    <fieldset disabled={!update || !!busy} className={styles.dateFields}>
                      <div><span className={styles.fieldLabel}>Von</span><AdminDatePicker value={draft.visibleFrom ?? ""} onChange={(value) => change({ visibleFrom: value || null })} ariaLabel="Sichtbar ab" {...(draft.visibleUntil ? { maxDate: draft.visibleUntil } : {})} /><button type="button" className={styles.dateShortcut} onClick={() => change({ visibleFrom: null })}>Ab sofort{!draft.visibleFrom && <Check size={11} />}</button></div>
                      <div><span className={styles.fieldLabel}>Bis</span><AdminDatePicker value={draft.visibleUntil ?? ""} onChange={(value) => change({ visibleUntil: value || null })} ariaLabel="Sichtbar bis einschließlich" {...(draft.visibleFrom ? { minDate: draft.visibleFrom } : {})} /><button type="button" className={styles.dateShortcut} onClick={() => change({ visibleUntil: null })}>Ohne Ende{!draft.visibleUntil && <Check size={11} />}</button></div>
                    </fieldset>
                    <div className={styles.visibilitySummary}><CalendarDays size={13} /><span>{visibility(draft.visibleFrom, draft.visibleUntil)}</span></div>
                    {!valid && !!draft.title.trim() && <p className={styles.fieldError}>Das Ende muss nach dem Beginn liegen.</p>}
                  </section>
                </div> : <div role="tabpanel" id="briefing-settings-page" aria-labelledby="briefing-tab-page" className={styles.settingsPanel}>
                  <section className={styles.formSection}>
                    <div className={styles.sectionTitle}><h3>Seite {page} <span>von {draft.file.pageCount}</span></h3><span className={styles.optional}>optional</span></div>
                    <label className={styles.field}>Überschrift<input value={selectedPage?.title ?? ""} disabled={!update || !!busy} maxLength={160} onChange={(event) => changePage({ title: event.target.value })} placeholder="Überschrift zur Seite" /></label>
                    <label className={styles.field}>Beschreibung<textarea value={selectedPage?.description ?? ""} disabled={!update || !!busy} maxLength={4000} rows={6} onChange={(event) => changePage({ description: event.target.value })} placeholder="Hinweise zu dieser Seite …" /></label>
                  </section>
                </div>}
                <div className={styles.documentTools}>
                  {published && <>
                    <button type="button" className={styles.historyToggle} aria-expanded={history} onClick={() => setHistory((value) => !value)}><History size={13} /><span>Veröffentlichungen</span><span className={styles.historyCount}>{draft.publications?.length}</span><ChevronDown size={12} style={{ transform: history ? "rotate(180deg)" : undefined }} /></button>
                    {history && <div className={styles.history}>{draft.publications?.map((publication) => <div key={publication.id}><strong>Version {publication.version}</strong><span>{visibility(publication.visibleFrom, publication.visibleUntil)}</span></div>)}</div>}
                  </>}
                  <button type="button" className={styles.archiveButton} disabled={!update || !!busy || dirty} title={dirty ? "Bitte zuerst den Entwurf speichern" : undefined} onClick={archive}>{draft.archivedAt ? <RotateCcw size={13} /> : <Archive size={13} />}{draft.archivedAt ? "Wiederherstellen" : "Archivieren"}</button>
                </div>
              </div>
            </aside>
            <section className={styles.previewPanel} aria-label="PDF-Vorschau">
              <div className={styles.previewToolbar}>
                <div className={styles.pageControls}>
                  <button type="button" className={styles.iconButton} disabled={page === 1} onClick={() => setPage((value) => value - 1)} aria-label="Vorherige Seite"><ChevronLeft size={14} /></button>
                  <span>Seite <strong>{page}</strong> von {draft.file.pageCount}</span>
                  <button type="button" className={styles.iconButton} disabled={page === draft.file.pageCount} onClick={() => setPage((value) => value + 1)} aria-label="Nächste Seite"><ChevronRight size={14} /></button>
                </div>
                <div className={styles.fitSwitch} aria-label="PDF-Ansicht">
                  <button type="button" aria-label="Ganze Seite einpassen" title="Ganze Seite einpassen" aria-pressed={fitMode === "page"} onClick={() => setFitMode("page")}><Maximize size={12} /><span>Ganze Seite</span></button>
                  <button type="button" aria-label="Seitenbreite einpassen" title="Seitenbreite einpassen" aria-pressed={fitMode === "width"} onClick={() => setFitMode("width")}><MoveHorizontal size={13} /><span>Breite</span></button>
                </div>
                <button type="button" className={styles.replaceButton} disabled={!update || !!busy} onClick={() => chooseFile(true)}><RotateCcw size={12} /><span>PDF ersetzen</span></button>
              </div>
              <div ref={previewStage} className={styles.previewStage} data-fit={fitMode}>
                {previewError || pdfError ? <div className={styles.previewFailure}><FileText size={25} strokeWidth={1.4} /><p>Die PDF konnte nicht geladen werden.</p><button type="button" className={styles.secondary} onClick={() => setPreviewAttempt((value) => value + 1)}>Erneut laden</button></div>
                  : <div className={styles.pageStack} style={{ width: fitMode === "page" ? fittedWidth : undefined }}>
                    <div className={styles.paper} style={{ aspectRatio: String(ratio) }}><PdfPage key={`${draft.file.path}:${page}`} pdf={pdf} pageNumber={page} /></div>
                    {(selectedPage?.title || selectedPage?.description) && <div className={styles.pageCaption}>{selectedPage.title && <h3>{selectedPage.title}</h3>}{selectedPage.description && <p>{selectedPage.description}</p>}</div>}
                  </div>}
              </div>
              {draft.file.pageCount > 1 && <nav className={styles.pageStrip} aria-label="PDF-Seiten">
                {draft.pages.map((entry) => <button type="button" key={entry.pageNumber} data-briefing-page aria-current={page === entry.pageNumber} aria-label={`Seite ${entry.pageNumber} anzeigen`} className={styles.thumbnail} onClick={() => setPage(entry.pageNumber)}>
                  <span className={styles.thumbnailPaper} style={{ aspectRatio: `${draft.file.dimensions[entry.pageNumber - 1]?.width ?? 595}/${draft.file.dimensions[entry.pageNumber - 1]?.height ?? 842}` }}>{Math.abs(entry.pageNumber - page) <= 3 ? <PdfPage pdf={pdf} pageNumber={entry.pageNumber} thumbnail /> : <span className={styles.thumbnailPlaceholder}><FileText size={15} /></span>}</span>
                  <span>{String(entry.pageNumber).padStart(2, "0")}</span>
                </button>)}
              </nav>}
            </section>
          </div>
        </>
      )}
      {dragging && <div className={styles.dropOverlay}><Upload size={28} strokeWidth={1.5} /><strong>PDF loslassen</strong><span>Als neues Dokument hinzufügen</span></div>}
      {confirm && <Confirmation title={confirm.title} text={confirm.text} label={confirm.label} onClose={() => setConfirm(null)} onConfirm={() => { const action = confirm.action; setConfirm(null); action(); }} />}
    </div>
  );
}
function fileSummary(item: BriefingDraft) {
  const size = item.file.byteSize < 1048576
    ? `${Math.max(1, Math.round(item.file.byteSize / 1024))} KB`
    : `${(item.file.byteSize / 1048576).toLocaleString("de-AT", { maximumFractionDigits: 1 })} MB`;
  return `${item.file.pageCount} ${item.file.pageCount === 1 ? "Seite" : "Seiten"} · ${size}`;
}
function visibility(from: string | null, until: string | null) {
  if (!from && !until) return "Ab sofort · ohne Ende";
  if (!until) return `Ab ${date(from!)}`;
  return `${from ? date(from) : "Ab sofort"} – ${date(until)}`;
}
function Status({ item }: { item: BriefingDraft }) {
  const state = publicationState(item);
  return <span className={styles.statusPill} data-state={state}><span />{state}</span>;
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
  useLayoutEffect(() => {
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
