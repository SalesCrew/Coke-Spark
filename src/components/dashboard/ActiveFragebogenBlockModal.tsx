"use client";

import { createPortal } from "react-dom";
import { X } from "lucide-react";

interface ActiveFragebogenBlockModalProps {
  open: boolean;
  opening?: boolean;
  marketName?: string;
  campaignNames?: string[];
  onClose: () => void;
  onOpenActive: () => void;
}

export function ActiveFragebogenBlockModal({
  open,
  opening = false,
  marketName,
  campaignNames = [],
  onClose,
  onOpenActive,
}: ActiveFragebogenBlockModalProps) {
  if (!open || typeof document === "undefined") return null;

  const primaryCampaignName = campaignNames[0] ?? "Laufender Fragebogen";

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Aktiver Fragebogen läuft"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 260,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        background: "rgba(15,23,42,0.25)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        fontFamily: "var(--font-inter), Inter, system-ui, sans-serif",
      }}
    >
      <div
        style={{
          width: "min(380px, calc(100vw - 36px))",
          borderRadius: 18,
          border: "1px solid rgba(0,0,0,0.06)",
          background: "#ffffff",
          boxShadow: "0 22px 60px rgba(15,23,42,0.18), 0 2px 8px rgba(0,0,0,0.04)",
          padding: 18,
          color: "#111827",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 12,
              display: "grid",
              placeItems: "center",
              background: "rgba(220,38,38,0.07)",
              boxShadow: "inset 0 0 0 1px rgba(220,38,38,0.12)",
              flexShrink: 0,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                background: "#DC2626",
                boxShadow: "0 0 0 4px rgba(220,38,38,0.10)",
              }}
            />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                fontSize: 9,
                fontWeight: 800,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "rgba(0,0,0,0.42)",
                marginBottom: 5,
              }}
            >
              Aktiver Fragebogen
            </div>
            <h2 style={{ margin: 0, fontSize: 17, lineHeight: 1.18, fontWeight: 800, letterSpacing: 0 }}>
              Erst laufenden Fragebogen abschließen
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={opening}
            aria-label="Schließen"
            style={{
              width: 30,
              height: 30,
              border: "none",
              borderRadius: 10,
              background: "rgba(0,0,0,0.04)",
              color: "rgba(0,0,0,0.45)",
              display: "grid",
              placeItems: "center",
              cursor: opening ? "not-allowed" : "pointer",
              fontFamily: "inherit",
              flexShrink: 0,
            }}
          >
            <X size={14} strokeWidth={2.2} />
          </button>
        </div>

        <p
          style={{
            margin: "13px 0 0",
            fontSize: 12,
            lineHeight: 1.5,
            fontWeight: 600,
            color: "rgba(0,0,0,0.52)",
          }}
        >
          Du hast bereits einen Fragebogen offen. Bitte beende oder brich diesen zuerst ab, bevor du einen neuen
          Marktbesuch startest.
        </p>

        <div
          style={{
            marginTop: 14,
            borderRadius: 13,
            background: "rgba(0,0,0,0.025)",
            boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.06)",
            padding: "11px 12px",
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 800,
              color: "#111827",
              lineHeight: 1.25,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {primaryCampaignName}
          </div>
          {campaignNames.length > 1 && (
            <div style={{ marginTop: 3, fontSize: 10, fontWeight: 700, color: "rgba(0,0,0,0.38)" }}>
              +{campaignNames.length - 1} weitere Sektion
            </div>
          )}
          {marketName && (
            <div
              style={{
                marginTop: 6,
                fontSize: 10,
                fontWeight: 700,
                color: "rgba(0,0,0,0.44)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {marketName}
            </div>
          )}
        </div>

        <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "0.85fr 1.25fr", gap: 9 }}>
          <button
            type="button"
            onClick={onClose}
            disabled={opening}
            style={{
              height: 34,
              border: "none",
              borderRadius: 8,
              background: "rgba(0,0,0,0.045)",
              color: "rgba(0,0,0,0.50)",
              fontSize: 10,
              fontWeight: 750,
              cursor: opening ? "not-allowed" : "pointer",
              fontFamily: "inherit",
              boxShadow: "0 0 0 0.5px rgba(0,0,0,0.07)",
            }}
          >
            Schließen
          </button>
          <button
            type="button"
            onClick={onOpenActive}
            disabled={opening}
            style={{
              height: 34,
              border: "none",
              borderRadius: 8,
              background: opening ? "rgba(0,0,0,0.10)" : "linear-gradient(to bottom, #059669, #0cb880)",
              color: opening ? "rgba(0,0,0,0.26)" : "#ffffff",
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.01em",
              cursor: opening ? "wait" : "pointer",
              fontFamily: "inherit",
              boxShadow: opening
                ? "none"
                : "inset 0 1px 0.6px rgba(255,255,255,0.33), inset 0 -1px 0 rgba(255,255,255,0.15), 0 0 0 1px #048560, 0 1px 8px rgba(5,80,50,0.16)",
            }}
          >
            {opening ? "Öffne..." : "Zum aktiven Fragebogen"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
