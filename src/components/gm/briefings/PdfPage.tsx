"use client";
import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, PDFPageProxy, RenderTask } from "pdfjs-dist";
import { LoaderCircle, RotateCcw } from "lucide-react";
import styles from "./briefings.module.css";
const assets = "/pdfjs/6.4.299-legacy/";
export function useBriefingPdf(url: string | null) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null),
    [error, setError] = useState(""),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    setPdf(null);
    setError("");
    if (!url) return;
    const controller = new AbortController();
    let disposed = false,
      destroy: (() => void) | undefined;
    void (async () => {
      try {
        const renderer = await import("pdfjs-dist/legacy/build/pdf.mjs");
        renderer.GlobalWorkerOptions.workerSrc = `${assets}pdf.worker.min.mjs`;
        const response = await fetch(url, {
          signal: controller.signal,
          cache: "no-store",
          credentials: "omit",
        });
        if (!response.ok) throw new Error("PDF konnte nicht geladen werden.");
        const bytes = new Uint8Array(await response.arrayBuffer());
        if (disposed) return;
        const task = renderer.getDocument({
          data: bytes,
          cMapUrl: `${assets}cmaps/`,
          cMapPacked: true,
          standardFontDataUrl: `${assets}standard_fonts/`,
          wasmUrl: `${assets}wasm/`,
          enableXfa: false,
        });
        destroy = () => {
          void task.destroy();
        };
        const document = await task.promise;
        if (disposed) {
          destroy();
          return;
        }
        setPdf(document);
      } catch (e) {
        if (!disposed)
          setError(
            e instanceof Error ? e.message : "PDF konnte nicht geladen werden.",
          );
      }
    })();
    return () => {
      disposed = true;
      controller.abort();
      destroy?.();
    };
  }, [url, attempt]);
  return { pdf, error, retry: () => setAttempt((value) => value + 1) };
}
export function PdfPage({
  pdf,
  pageNumber,
  onRendered,
  thumbnail = false,
}: {
  pdf: PDFDocumentProxy | null;
  pageNumber: number;
  onRendered?: () => void;
  thumbnail?: boolean;
}) {
  const root = useRef<HTMLDivElement>(null),
    canvas = useRef<HTMLCanvasElement>(null),
    callback = useRef(onRendered);
  const [width, setWidth] = useState(0),
    [ready, setReady] = useState(false),
    [error, setError] = useState(""),
    [text, setText] = useState(""),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    callback.current = onRendered;
  }, [onRendered]);
  useEffect(() => {
    if (!root.current) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.floor(entry.contentRect.width)),
    );
    observer.observe(root.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    // A new external canvas render invalidates the previous render status.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReady(false);
    setError("");
    if (!pdf || !width || !canvas.current) return;
    let disposed = false,
      render: RenderTask | undefined,
      page: PDFPageProxy | undefined;
    void (async () => {
      try {
        page = await pdf.getPage(pageNumber);
        if (disposed || !canvas.current) return;
        const scale = width / page.getViewport({ scale: 1 }).width,
          pixelRatio = Math.min(
            window.devicePixelRatio || 1,
            thumbnail ? 1.5 : 2,
          ),
          viewport = page.getViewport({ scale: scale * pixelRatio });
        const target = canvas.current;
        target.width = Math.floor(viewport.width);
        target.height = Math.floor(viewport.height);
        target.style.width = `${width}px`;
        target.style.height = `${viewport.height / pixelRatio}px`;
        render = page.render({ canvas: target, viewport });
        await render.promise;
        if (disposed) return;
        setReady(true);
        callback.current?.();
        if (!thumbnail) {
          const content = await page.getTextContent();
          if (!disposed)
            setText(
              content.items
                .map((item) => ("str" in item ? item.str : ""))
                .join(" "),
            );
        }
      } catch (e) {
        if (!disposed && (e as Error).name !== "RenderingCancelledException")
          setError("Seite konnte nicht dargestellt werden.");
      }
    })();
    return () => {
      disposed = true;
      render?.cancel();
    };
  }, [pdf, pageNumber, width, thumbnail, retry]);
  return (
    <div ref={root} className={styles.pdfPage} aria-busy={!ready && !error}>
      <canvas
        ref={canvas}
        role="img"
        aria-label={`PDF-Seite ${pageNumber}`}
        style={{ opacity: ready ? 1 : 0 }}
      />
      {!ready && !error && (
        <div className={styles.pdfLoading}>
          <LoaderCircle size={thumbnail ? 14 : 22} className={styles.spinner} />
          <span className={styles.srOnly}>Seite wird geladen</span>
        </div>
      )}
      {error && (
        <div className={styles.pdfError}>
          <p>{error}</p>
          <button type="button" onClick={() => setRetry((value) => value + 1)}>
            <RotateCcw size={14} />
            Erneut laden
          </button>
        </div>
      )}
      {!thumbnail && <p className={styles.srOnly}>{text}</p>}
    </div>
  );
}
