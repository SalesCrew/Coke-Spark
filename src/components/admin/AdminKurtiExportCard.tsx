"use client";

import { useState } from "react";
import { Check, Download, FileSpreadsheet, LoaderCircle, TriangleAlert } from "lucide-react";
import { type AdminKurtiExcelExport } from "@/lib/api/backend";
import { describeAdminKurtiExcelExport, runAdminKurtiExcelExport } from "@/lib/exports/adminKurtiExport";

type ExportState = "idle" | "loading" | "success" | "error";

export function AdminKurtiExportCard({ exportSpec }: { exportSpec: AdminKurtiExcelExport }) {
  const [state, setState] = useState<ExportState>("idle");
  const [error, setError] = useState<string | null>(null);
  const filterSummary = describeAdminKurtiExcelExport(exportSpec);

  async function download() {
    if (state === "loading") return;
    setState("loading");
    setError(null);
    try {
      await runAdminKurtiExcelExport(exportSpec);
      setState("success");
    } catch (caught) {
      setState("error");
      setError(caught instanceof Error ? caught.message : "Der Export konnte nicht erstellt werden.");
    }
  }

  const StatusIcon = state === "loading" ? LoaderCircle : state === "success" ? Check : state === "error" ? TriangleAlert : Download;
  const buttonLabel = state === "loading"
    ? "Export wird erstellt ..."
    : state === "success"
      ? "Erneut herunterladen"
      : state === "error"
        ? "Erneut versuchen"
        : "Excel herunterladen";

  return (
    <section
      aria-label={`Excel-Export: ${exportSpec.title}`}
      style={{
        marginTop: 10,
        border: "1px solid rgba(15,23,42,0.1)",
        borderRadius: 13,
        overflow: "hidden",
        background: "rgba(255,255,255,0.76)",
        boxShadow: "0 8px 20px rgba(15,23,42,0.055)",
      }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "34px minmax(0,1fr)", gap: 10, padding: "12px 12px 10px" }}>
        <div
          aria-hidden="true"
          style={{
            width: 34,
            height: 34,
            borderRadius: 9,
            display: "grid",
            placeItems: "center",
            color: "#16865c",
            background: "rgba(16,185,129,0.09)",
            border: "1px solid rgba(16,185,129,0.16)",
          }}
        >
          <FileSpreadsheet size={17} strokeWidth={2} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ color: "rgba(15,23,42,0.9)", fontSize: 12.5, fontWeight: 760, lineHeight: 1.28 }}>{exportSpec.title}</div>
          {exportSpec.description ? (
            <div style={{ marginTop: 3, color: "rgba(71,85,105,0.76)", fontSize: 10.5, fontWeight: 530, lineHeight: 1.42 }}>
              {exportSpec.description}
            </div>
          ) : null}
          {filterSummary.length > 0 ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 7 }}>
              {filterSummary.map((label) => (
                <span key={label} style={{ padding: "3px 6px", borderRadius: 6, background: "rgba(15,23,42,0.045)", color: "rgba(71,85,105,0.7)", fontSize: 9.5, fontWeight: 620 }}>
                  {label}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      {error ? (
        <div role="alert" style={{ margin: "0 12px 9px", color: "#b91c1c", fontSize: 10.5, fontWeight: 620, lineHeight: 1.42 }}>
          {error}
        </div>
      ) : null}
      <button
        type="button"
        onClick={() => { void download(); }}
        disabled={state === "loading"}
        style={{
          width: "100%",
          minHeight: 38,
          padding: "0 12px",
          border: 0,
          borderTop: "1px solid rgba(15,23,42,0.075)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          color: state === "success" ? "#087f5b" : state === "error" ? "#b91c1c" : "rgba(15,23,42,0.82)",
          background: state === "success" ? "rgba(16,185,129,0.055)" : state === "error" ? "rgba(239,68,68,0.045)" : "rgba(248,250,252,0.62)",
          cursor: state === "loading" ? "wait" : "pointer",
          fontFamily: "inherit",
          fontSize: 10.5,
          fontWeight: 720,
          textAlign: "left",
        }}
      >
        <span>{buttonLabel}</span>
        <StatusIcon size={15} strokeWidth={2.1} className={state === "loading" ? "admin-kurti-export-spin" : undefined} />
      </button>
      <style>{`@keyframes adminKurtiExportSpin { to { transform: rotate(360deg); } } .admin-kurti-export-spin { animation: adminKurtiExportSpin 0.8s linear infinite; }`}</style>
    </section>
  );
}
