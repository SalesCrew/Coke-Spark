"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
} from "lucide-react";
import { requestGmBriefings } from "@/lib/api/backend";
import type { GmBriefing } from "@/types/gmBriefings";
import { PdfPage, useBriefingPdf } from "./PdfPage";
import styles from "./briefings.module.css";

type Origin = { left: number; top: number; width: number; height: number };
export function GmBriefingReader({
  items,
  origin,
  onClose,
  onRead,
  onRefresh,
}: {
  items: GmBriefing[];
  origin: Origin;
  onClose: () => void;
  onRead: () => void;
  onRefresh: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    carousel = useRef<HTMLDivElement>(null),
    closing = useRef(false),
    [index, setIndex] = useState(0);
  const [selectedId, setSelectedId] = useState(
      () => items.find((item) => !item.readAt)?.id ?? items[0]?.id,
    ),
    [chooser, setChooser] = useState(false);
  const selected = items.find((item) => item.id === selectedId),
    [fileUrl, setFileUrl] = useState<string | null>(null),
    [fileError, setFileError] = useState(""),
    [fileAttempt, setFileAttempt] = useState(0);
  const [rendered, setRendered] = useState<Set<number>>(() => new Set()),
    [acknowledged, setAcknowledged] = useState<Set<number>>(() => new Set()),
    [readError, setReadError] = useState(""),
    [ackAttempt, setAckAttempt] = useState(0),
    [visible, setVisible] = useState(!document.hidden);
  const { pdf, error: pdfError } = useBriefingPdf(fileUrl);
  const close = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    const node = dialog.current;
    if (!node || matchMedia("(prefers-reduced-motion: reduce)").matches) {
      onClose();
      return;
    }
    const destination =
      document
        .querySelector<HTMLElement>("[data-gm-briefings-menu]")
        ?.getBoundingClientRect() ?? origin;
    const transform = `translate(${destination.left}px, ${destination.top}px) scale(${destination.width / innerWidth}, ${destination.height / innerHeight})`;
    node
      .querySelector<HTMLElement>("[data-reader-inner]")
      ?.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: 100,
        fill: "forwards",
      });
    const animation = node.animate(
      [
        { transform: "none", borderRadius: "0px" },
        { transform, borderRadius: "14px", opacity: 0.5 },
      ],
      { duration: 280, easing: "cubic-bezier(.32,.72,0,1)", fill: "forwards" },
    );
    animation.onfinish = onClose;
  }, [onClose, origin]);
  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    node.showModal();
    node
      .querySelector<HTMLButtonElement>("button")
      ?.focus({ preventScroll: true });
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
      node.animate(
        [
          {
            transform: `translate(${origin.left}px, ${origin.top}px) scale(${origin.width / innerWidth}, ${origin.height / innerHeight})`,
            borderRadius: "14px",
            opacity: 0.5,
          },
          { transform: "none", borderRadius: "0px", opacity: 1 },
        ],
        { duration: 420, easing: "cubic-bezier(.32,.72,0,1)" },
      );
      node
        .querySelector<HTMLElement>("[data-reader-inner]")
        ?.animate([{ opacity: 0 }, { opacity: 1 }], {
          duration: 240,
          delay: 130,
          fill: "backwards",
        });
    }
    return () => {
      document.body.style.overflow = previousOverflow;
      node.close();
    };
  }, [origin]);
  useEffect(() => {
    let cancelled = false;
    setFileUrl(null);
    setFileError("");
    setRendered(new Set());
    setAcknowledged(new Set(selected?.seenPages ?? []));
    setReadError("");
    setIndex(0);
    carousel.current?.scrollTo({ left: 0, behavior: "instant" });
    if (!selected) return;
    void requestGmBriefings<{ url: string }>(
      `/gm/briefings/${selected.id}/file`,
    )
      .then((data) => {
        if (!cancelled) setFileUrl(data.url);
      })
      .catch((error) => {
        if (!cancelled) setFileError(error.message);
      });
    return () => {
      cancelled = true;
    };
    // Read receipts arriving through refresh do not reset the open document or page.
  }, [selectedId, fileAttempt, selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const update = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  useEffect(() => {
    if (
      !selected ||
      !visible ||
      !rendered.has(index + 1) ||
      acknowledged.has(index + 1) ||
      !dialog.current?.open
    )
      return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void requestGmBriefings(
        `/gm/briefings/${selected.id}/read`,
        { pageNumber: index + 1 },
        "POST",
      )
        .then(() => {
          if (!cancelled) {
            setAcknowledged((previous) => new Set(previous).add(index + 1));
            setReadError("");
            onRead();
          }
        })
        .catch(() => {
          if (!cancelled) setReadError("Lesestatus noch nicht gespeichert.");
        });
    }, 900);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [selected, index, rendered, acknowledged, visible, ackAttempt, onRead]);
  function go(next: number) {
    const node = carousel.current;
    if (!node || !selected) return;
    const page = Math.max(0, Math.min(selected.pageCount - 1, next));
    node.scrollTo({
      left: page * node.clientWidth,
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  }
  useEffect(() => {
    if (!chooser) return;
    const outside = (event: PointerEvent) => {
      if (
        event.target instanceof Element &&
        !event.target.closest("[data-briefing-chooser]")
      )
        setChooser(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [chooser]);
  const allRead = !!selected && acknowledged.size === selected.pageCount;
  return createPortal(
    <dialog
      ref={dialog}
      className={styles.reader}
      aria-labelledby="gm-briefing-title"
      onCancel={(event) => {
        event.preventDefault();
        if (chooser) setChooser(false);
        else close();
      }}
      onKeyDown={(event) => {
        if (
          event.target instanceof HTMLElement &&
          event.target.closest("[data-briefing-chooser]")
        )
          return;
        if (event.key === "ArrowRight") {
          event.preventDefault();
          go(index + 1);
        }
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          go(index - 1);
        }
      }}
    >
      <div className={styles.readerInner} data-reader-inner>
        <header className={styles.readerHeader}>
          <button
            type="button"
            className={styles.back}
            aria-label="Zurück zum Home-Menü"
            onClick={close}
          >
            <ChevronLeft size={19} />
          </button>
          <div className={styles.readerHeading}>
            <h2 id="gm-briefing-title">
              {selected?.title ?? "Wochenschwerpunkte"}
            </h2>
            <p>
              Wochenschwerpunkte
              {selected?.visibleUntil
                ? ` · bis ${new Date(`${selected.visibleUntil}T12:00:00`).toLocaleDateString("de-AT", { day: "2-digit", month: "2-digit" })}`
                : ""}
            </p>
          </div>
          {items.length > 1 && (
            <div data-briefing-chooser style={{ position: "relative" }}>
              <button
                type="button"
                className={styles.back}
                aria-label="Andere Wochenschwerpunkte"
                aria-expanded={chooser}
                onClick={() => setChooser((value) => !value)}
              >
                <ChevronDown size={17} />
              </button>
              {chooser && (
                <div className={styles.chooser}>
                  {items.map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      onClick={() => {
                        setSelectedId(item.id);
                        setChooser(false);
                      }}
                      aria-current={selectedId === item.id}
                    >
                      <span>{item.title}</span>
                      {!item.readAt && <i />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {selected && (
            <span className={styles.readerPager}>
              {index + 1}
              <span style={{ color: "#b4b4bd" }}> / {selected.pageCount}</span>
            </span>
          )}
        </header>
        {!selected ? (
          <div className={styles.status}>
            Dieser Wochenschwerpunkt ist nicht mehr aktiv.
            <button onClick={onRefresh}>Aktualisieren</button>
          </div>
        ) : fileError || pdfError ? (
          <div role="alert" className={styles.status}>
            <div>
              <p>{fileError || "Die PDF konnte nicht dargestellt werden."}</p>
              <button
                type="button"
                onClick={() => setFileAttempt((value) => value + 1)}
              >
                Erneut laden
              </button>
            </div>
          </div>
        ) : (
          <div
            ref={carousel}
            className={styles.carousel}
            aria-label="PDF-Seiten, seitlich wischen"
            onScroll={(event) => {
              const node = event.currentTarget;
              setIndex(
                Math.round(node.scrollLeft / Math.max(1, node.clientWidth)),
              );
            }}
          >
            {selected.pages.map((page, i) => (
              <section
                key={`${selected.id}:${page.pageNumber}`}
                className={styles.slide}
                aria-label={`Seite ${page.pageNumber} von ${selected.pageCount}`}
                inert={i !== index}
                aria-hidden={i !== index}
              >
                <div className={styles.pageContent}>
                  <div className={styles.pdfFrame}>
                    {Math.abs(i - index) <= 1 ? (
                      <PdfPage
                        pdf={pdf}
                        pageNumber={page.pageNumber}
                        onRendered={() =>
                          setRendered((previous) =>
                            previous.has(page.pageNumber)
                              ? previous
                              : new Set(previous).add(page.pageNumber),
                          )
                        }
                      />
                    ) : (
                      <div style={{ aspectRatio: "595/842" }} />
                    )}
                  </div>
                  {(page.title ||
                    page.description ||
                    (i === 0 && selected.description)) && (
                    <div className={styles.caption}>
                      {i === 0 && selected.description && (
                        <p>{selected.description}</p>
                      )}
                      {page.title && <h3>{page.title}</h3>}
                      {page.description && <p>{page.description}</p>}
                    </div>
                  )}
                </div>
              </section>
            ))}
          </div>
        )}
        {readError && (
          <div role="status" className={styles.errorToast}>
            {readError}
            <button
              type="button"
              onClick={() => {
                setReadError("");
                setAckAttempt((value) => value + 1);
              }}
            >
              Erneut versuchen
            </button>
          </div>
        )}
        {selected && (
          <footer className={styles.readerFooter}>
            <button
              type="button"
              className={styles.arrow}
              disabled={index === 0}
              aria-label="Vorherige Seite"
              onClick={() => go(index - 1)}
            >
              <ChevronLeft size={16} />
            </button>
            <div className={styles.dots} aria-label="Seite wählen">
              {selected.pages.map((page, i) => (
                <button
                  key={page.pageNumber}
                  type="button"
                  className={styles.dot}
                  aria-label={`Seite ${page.pageNumber}`}
                  aria-current={index === i}
                  onClick={() => go(i)}
                >
                  <span />
                </button>
              ))}
            </div>
            <button
              type="button"
              className={styles.arrow}
              disabled={index === selected.pageCount - 1}
              aria-label="Nächste Seite"
              onClick={() => go(index + 1)}
            >
              <ChevronRight size={16} />
            </button>
            <span className={styles.readState} aria-live="polite">
              {allRead ? (
                <>
                  <Check size={12} />
                  Gelesen
                </>
              ) : !pdf && !fileError && !pdfError ? (
                <LoaderCircle size={12} className={styles.spinner} />
              ) : (
                `${acknowledged.size} / ${selected.pageCount}`
              )}
            </span>
          </footer>
        )}
      </div>
    </dialog>,
    document.body,
  );
}
