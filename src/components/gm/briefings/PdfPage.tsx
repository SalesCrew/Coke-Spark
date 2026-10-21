"use client";
import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, PDFPageProxy, RenderTask } from "pdfjs-dist";
import { ExternalLink, LoaderCircle, RotateCcw } from "lucide-react";
import { briefingRenderSizes } from "@/lib/gm/briefingPdf";
import { reportBriefingPdfFailure } from "@/lib/gm/briefingPdfTelemetry";
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
          // Avoid probing very large scratch canvases on constrained devices.
          canvasMaxAreaInBytes: 16 * 1024 * 1024,
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
        if (!disposed) {
          reportBriefingPdfFailure("document", e);
          setError(
            e instanceof Error ? e.message : "PDF konnte nicht geladen werden.",
          );
        }
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
type RecoveryProps = { onOpenOriginal?: () => void; openingOriginal?: boolean };
export function PdfRecoveryActions({ onRetry, onOpenOriginal, openingOriginal }: RecoveryProps & { onRetry: () => void }) {
  return (
    <div className={styles.pdfActions}>
      <button type="button" onClick={onRetry}><RotateCcw size={14} /> Erneut laden</button>
      {onOpenOriginal && (
        <button type="button" onClick={onOpenOriginal} disabled={openingOriginal}>
          {openingOriginal ? <LoaderCircle size={14} className={styles.spinner} /> : <ExternalLink size={14} />}
          {openingOriginal ? "PDF wird geöffnet …" : "PDF öffnen"}
        </button>
      )}
    </div>
  );
}
export function PdfPage({
  pdf,
  pageNumber,
  onRendered,
  onRenderStart,
  thumbnail = false,
  onOpenOriginal,
  openingOriginal,
}: {
  pdf: PDFDocumentProxy | null;
  pageNumber: number;
  onRendered?: () => void;
  onRenderStart?: () => void;
  thumbnail?: boolean;
} & RecoveryProps) {
  const root = useRef<HTMLDivElement>(null),
    canvas = useRef<HTMLCanvasElement>(null),
    callback = useRef({ onRendered, onRenderStart });
  const [width, setWidth] = useState(0),
    [ready, setReady] = useState(false),
    [error, setError] = useState(""),
    [text, setText] = useState(""),
    [aspectRatio, setAspectRatio] = useState(595 / 842),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    callback.current = { onRendered, onRenderStart };
  }, [onRendered, onRenderStart]);
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
    setText("");
    callback.current.onRenderStart?.();
    if (!pdf || !width || !canvas.current) return;
    let disposed = false,
      render: RenderTask | undefined,
      page: PDFPageProxy | undefined;
    const target = canvas.current;
    void (async () => {
      try {
        page = await pdf.getPage(pageNumber);
        if (disposed) {
          page.cleanup();
          return;
        }
        const base = page.getViewport({ scale: 1 });
        setAspectRatio(base.width / base.height);
        const sizes = briefingRenderSizes({ width, pageWidth: base.width, pageHeight: base.height,
          pixelRatio: window.devicePixelRatio || 1, thumbnail });
        for (const [attempt, size] of sizes.entries()) {
          if (disposed) return;
          try {
            target.width = size.width;
            target.height = size.height;
            target.style.width = `${width}px`;
            target.style.height = `${size.cssHeight}px`;
            render = page.render({ canvas: target, viewport: page.getViewport({ scale: size.scale }) });
            await render.promise;
            break;
          } catch (e) {
            if (disposed || (e as Error)?.name === "RenderingCancelledException") return;
            // PDF.js can retain its canvas lock after a rejected render promise.
            render?.cancel();
            reportBriefingPdfFailure("render", e, { attempt: attempt + 1, width: size.width, height: size.height });
            target.width = 0;
            target.height = 0;
            if (attempt === sizes.length - 1) {
              setError("Diese Seite konnte nicht angezeigt werden.");
              return;
            }
          }
        }
        if (disposed) return;
        setReady(true);
        callback.current.onRendered?.();
        if (!thumbnail) {
          try {
            const content = await page.getTextContent();
            if (!disposed) setText(content.items.map((item) => ("str" in item ? item.str : "")).join(" "));
          } catch (e) {
            // Optional text extraction must not cover a successfully rendered page.
            if (!disposed) reportBriefingPdfFailure("text", e);
          }
        }
      } catch (e) {
        if (!disposed && (e as Error)?.name !== "RenderingCancelledException") {
          reportBriefingPdfFailure("page", e);
          setError("Diese Seite konnte nicht angezeigt werden.");
        }
      }
    })();
    return () => {
      disposed = true;
      render?.cancel();
      target.width = 0;
      target.height = 0;
      page?.cleanup();
    };
  }, [pdf, pageNumber, width, thumbnail, retry]);
  return (
    <div ref={root} className={styles.pdfPage} style={{ aspectRatio }} aria-busy={!ready && !error}>
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
        <div className={styles.pdfError} role="alert">
          <p>{error}</p>
          <PdfRecoveryActions onRetry={() => setRetry((value) => value + 1)} onOpenOriginal={onOpenOriginal} openingOriginal={openingOriginal} />
        </div>
      )}
      {!thumbnail && <p className={styles.srOnly}>{text}</p>}
    </div>
  );
}
