"use client";

import { useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { Camera, Check, Image as ImageIcon, Loader2, X } from "lucide-react";
import {
  fetchTimeTrackingDoctorConfirmation,
  uploadTimeTrackingDoctorConfirmation,
  type TimeTrackingEntry,
} from "@/lib/api/backend";

type DoctorConfirmationState = {
  isRequired: boolean;
  isUploaded: boolean;
  uploadedAt: string | null;
  fileName: string | null;
} | null | undefined;

type Props = {
  entryId: string;
  doctorConfirmation: DoctorConfirmationState;
  canUpload?: boolean;
  onUploaded?: (entry: TimeTrackingEntry) => void | Promise<void>;
  size?: "sm" | "md";
};

const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "heic", "heif"]);

function isAllowedPhoto(file: File): boolean {
  if (file.type && !file.type.toLowerCase().startsWith("image/")) return false;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return !ext || ALLOWED_EXTENSIONS.has(ext);
}

export function DoctorConfirmationProofButton({
  entryId,
  doctorConfirmation,
  canUpload = false,
  onUploaded,
  size = "sm",
}: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [loadingUrl, setLoadingUrl] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!doctorConfirmation?.isRequired) return null;

  const uploaded = doctorConfirmation.isUploaded;
  const tone = uploaded ? "#059669" : "#DC2626";
  const iconSize = size === "md" ? 15 : 12;
  const boxSize = size === "md" ? 28 : 22;
  const busy = loadingUrl || uploading;

  async function openExistingPhoto() {
    if (!uploaded || loadingUrl) return;
    setLoadingUrl(true);
    setError(null);
    setImageError(false);
    try {
      const result = await fetchTimeTrackingDoctorConfirmation(entryId);
      setSignedUrl(result.doctorConfirmation.signedUrl);
      setViewerOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Arztbestätigung konnte nicht geöffnet werden.");
    } finally {
      setLoadingUrl(false);
    }
  }

  async function handleActivate(event?: MouseEvent | KeyboardEvent) {
    event?.stopPropagation();
    if (busy) return;
    if (uploaded) {
      await openExistingPhoto();
      return;
    }
    if (canUpload) {
      fileInputRef.current?.click();
      return;
    }
    setError("Noch keine Arztbestätigung hochgeladen.");
  }

  async function handleFileSelected(file: File | undefined) {
    if (!file || uploading) return;
    setError(null);
    if (file.size > MAX_PHOTO_BYTES) {
      setError("Foto ist zu groß. Maximal 10 MB sind erlaubt.");
      return;
    }
    if (!isAllowedPhoto(file)) {
      setError("Bitte ein Foto hochladen.");
      return;
    }
    setUploading(true);
    try {
      const result = await uploadTimeTrackingDoctorConfirmation(entryId, file);
      await onUploaded?.(result.entry);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Arztbestätigung konnte nicht hochgeladen werden.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <>
      <span
        role="button"
        tabIndex={0}
        aria-label={uploaded ? "Arztbestätigung öffnen" : canUpload ? "Arztbestätigung hochladen" : "Keine Arztbestätigung"}
        title={uploaded ? "Arztbestätigung öffnen" : canUpload ? "Arztbestätigung hochladen" : "Keine Arztbestätigung"}
        onClick={(event) => { void handleActivate(event); }}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          void handleActivate(event);
        }}
        style={{
          width: boxSize,
          height: boxSize,
          borderRadius: 8,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          color: tone,
          background: uploaded ? "rgba(5,150,105,0.08)" : "rgba(220,38,38,0.07)",
          boxShadow: `inset 0 0 0 1px ${uploaded ? "rgba(5,150,105,0.16)" : "rgba(220,38,38,0.16)"}`,
          cursor: busy ? "wait" : uploaded || canUpload ? "pointer" : "default",
          opacity: busy ? 0.72 : 0.78,
          flexShrink: 0,
        }}
      >
        {busy ? (
          <Loader2 size={iconSize} strokeWidth={2} style={{ animation: "doctorProofSpin 0.8s linear infinite" }} />
        ) : uploaded ? (
          <Check size={iconSize} strokeWidth={2.4} />
        ) : (
          <Camera size={iconSize} strokeWidth={2} />
        )}
      </span>
      {canUpload && !uploaded ? (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onClick={(event) => event.stopPropagation()}
          onChange={(event) => { void handleFileSelected(event.target.files?.[0]); }}
        />
      ) : null}
      {error ? (
        <span
          style={{
            marginLeft: 6,
            maxWidth: 190,
            color: "#b91c1c",
            fontSize: 9,
            fontWeight: 700,
            lineHeight: 1.25,
            verticalAlign: "middle",
          }}
        >
          {error}
        </span>
      ) : null}
      {viewerOpen && signedUrl && typeof document !== "undefined" ? createPortal(
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setViewerOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 10000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            background: "rgba(8,12,20,0.72)",
            backdropFilter: "blur(14px)",
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              width: "min(720px, 94vw)",
              maxHeight: "88vh",
              borderRadius: 20,
              background: "#101114",
              boxShadow: "0 24px 90px rgba(0,0,0,0.42)",
              overflow: "hidden",
              position: "relative",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <button
              type="button"
              onClick={() => setViewerOpen(false)}
              style={{
                position: "absolute",
                top: 10,
                right: 10,
                zIndex: 1,
                width: 32,
                height: 32,
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.16)",
                background: "rgba(255,255,255,0.12)",
                color: "#fff",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                boxShadow: "0 8px 24px rgba(0,0,0,0.22)",
              }}
              aria-label="Schließen"
            >
              <X size={17} strokeWidth={2} />
            </button>
            {imageError ? (
              <div
                style={{
                  minHeight: 320,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 12,
                  color: "rgba(255,255,255,0.72)",
                  padding: 24,
                  textAlign: "center",
                }}
              >
                <ImageIcon size={32} strokeWidth={1.7} />
                <div style={{ fontSize: 13, fontWeight: 700 }}>Foto kann hier nicht direkt angezeigt werden.</div>
                <a
                  href={signedUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: "#fff", fontSize: 12, fontWeight: 800, textDecoration: "underline" }}
                >
                  In neuem Tab öffnen
                </a>
              </div>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={signedUrl}
                alt={doctorConfirmation.fileName ?? "Arztbestätigung"}
                onError={() => setImageError(true)}
                style={{
                  display: "block",
                  width: "100%",
                  maxHeight: "82vh",
                  objectFit: "contain",
                  background: "#0b0c0f",
                }}
              />
            )}
            <div
              style={{
                padding: "10px 14px 12px",
                borderTop: "1px solid rgba(255,255,255,0.08)",
                color: "rgba(255,255,255,0.72)",
                fontSize: 11,
                fontWeight: 700,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {doctorConfirmation.fileName ?? "Arztbestätigung"}
            </div>
          </div>
        </div>,
        document.body,
      ) : null}
      <style jsx global>{`
        @keyframes doctorProofSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}
