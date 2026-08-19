"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Check, FileSpreadsheet, Upload, X } from "lucide-react";
import {
  buildPreviewGrid,
  getColHeader,
  getColSample,
  indexToExcelCol,
  isValidColLetter,
  readWorkbook,
  type WorkbookResult,
} from "@/utils/marketImport";
import type {
  ImportSmMarketsInput,
  SmMarketColumnMapping,
  SmMarketImportFieldKey,
  SmMarketImportSummary,
  SmMarketRecord,
} from "@/types/smMarkets";

const RED = "#DC2626";

type ImportFieldSpec = {
  key: SmMarketImportFieldKey;
  label: string;
  required?: boolean;
  identity?: boolean;
  aliases: string[];
};

const FIELD_SPECS: ImportFieldSpec[] = [
  { key: "flexNumber", label: "Flexnummer", identity: true, aliases: ["flexnummer", "flex nummer", "flex-nr", "flexnr"] },
  { key: "internalMarketId", label: "Stammnummern", identity: true, aliases: ["stammnummern", "stammnummer", "stammnr", "interne id"] },
  { key: "name", label: "Markt", required: true, aliases: ["markt", "market", "handelskette"] },
  { key: "postalCode", label: "PLZ", required: true, aliases: ["plz", "postleitzahl"] },
  { key: "city", label: "Ort", required: true, aliases: ["ort", "stadt", "city"] },
  { key: "address", label: "Adresse", required: true, aliases: ["adresse", "address", "strasse", "straße"] },
  { key: "region", label: "Region", required: true, aliases: ["region"] },
  { key: "serviceDaysPerWeek", label: "Betreuungstage pro Woche", aliases: ["betreuungstage pro woche", "betreuungs tage pro woche"] },
  { key: "mondayHours", label: "MO", aliases: ["mo", "montag"] },
  { key: "tuesdayHours", label: "DI", aliases: ["di", "dienstag"] },
  { key: "wednesdayHours", label: "MI", aliases: ["mi", "mittwoch"] },
  { key: "thursdayHours", label: "DO", aliases: ["do", "donnerstag"] },
  { key: "fridayHours", label: "FR", aliases: ["fr", "freitag"] },
  { key: "weeklyHours", label: "Stunden pro Woche", aliases: ["stunden pro woche", "wochenstunden"] },
  { key: "shelfMerchandiserName", label: "Shelf Merchandising Mitarbeiter", aliases: ["shelf merchandising mitarbeiter", "shelf merchandiser", "sm mitarbeiter"] },
  { key: "fieldServiceManagerName", label: "Field Service Gebietsleiter", aliases: ["field service gebietsleiter", "gebietsleiter", "field service gl"] },
  { key: "sourceInfo", label: "Info", aliases: ["info", "information", "kommentar"] },
  { key: "isActive", label: "Status aktiv", aliases: ["status", "aktiv", "is active"] },
];

function normalizeHeader(value: string): string {
  return value
    .toLocaleLowerCase("de-AT")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function suggestMapping(rows: string[][]): SmMarketColumnMapping {
  const header = rows[0] ?? [];
  const normalizedHeaders = header.map(normalizeHeader);
  const mapping: SmMarketColumnMapping = {};
  for (const spec of FIELD_SPECS) {
    const aliases = spec.aliases.map(normalizeHeader);
    const index = normalizedHeaders.findIndex((value) => aliases.includes(value));
    if (index >= 0) mapping[spec.key] = indexToExcelCol(index);
  }
  return mapping;
}

function validateMapping(mapping: SmMarketColumnMapping) {
  const errors: Partial<Record<SmMarketImportFieldKey, string>> = {};
  const duplicateErrors: Partial<Record<SmMarketImportFieldKey, string>> = {};
  for (const spec of FIELD_SPECS) {
    const value = mapping[spec.key] ?? "";
    if (spec.required && !isValidColLetter(value)) errors[spec.key] = "Pflichtfeld";
    if (value && !isValidColLetter(value)) errors[spec.key] = "Ungültige Spalte";
  }
  const hasIdentity = isValidColLetter(mapping.flexNumber ?? "") || isValidColLetter(mapping.internalMarketId ?? "");
  const seen = new Map<string, SmMarketImportFieldKey>();
  for (const [key, raw] of Object.entries(mapping) as Array<[SmMarketImportFieldKey, string | undefined]>) {
    if (!raw || !isValidColLetter(raw)) continue;
    const column = raw.toUpperCase();
    const owner = seen.get(column);
    if (owner) {
      duplicateErrors[key] = `Spalte ${column} doppelt`;
      duplicateErrors[owner] = `Spalte ${column} doppelt`;
    } else {
      seen.set(column, key);
    }
  }
  const summaryMapped = isValidColLetter(mapping.serviceDaysPerWeek ?? "") || isValidColLetter(mapping.weeklyHours ?? "");
  const weekdaysMapped = ["mondayHours", "tuesdayHours", "wednesdayHours", "thursdayHours", "fridayHours"]
    .every((key) => isValidColLetter(mapping[key as SmMarketImportFieldKey] ?? ""));
  return {
    errors,
    duplicateErrors,
    hasIdentity,
    planningComplete: !summaryMapped || weekdaysMapped,
    canImport: hasIdentity && Object.keys(errors).length === 0 && Object.keys(duplicateErrors).length === 0 && (!summaryMapped || weekdaysMapped),
  };
}

function MappingField({ spec, value, rows, error, onChange }: {
  spec: ImportFieldSpec;
  value: string;
  rows: string[][];
  error?: string;
  onChange: (value: string) => void;
}) {
  const header = value && !error ? getColHeader(rows, value) : null;
  const sample = value && !error ? getColSample(rows, value) : null;
  return (
    <label style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ display: "flex", alignItems: "center", gap: 5, color: error ? RED : "rgba(15,23,42,.55)", fontSize: 9, fontWeight: 750 }}>
        <span style={{ minWidth: 0, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{spec.label}</span>
        {spec.identity ? <small style={{ padding: "1px 4px", borderRadius: 3, background: "rgba(8,145,178,.08)", color: "#0891b2", fontSize: 7, fontWeight: 850 }}>ID</small> : null}
        {spec.required ? <small style={{ color: RED, fontSize: 8, fontWeight: 850 }}>*</small> : null}
      </span>
      <input
        value={value}
        maxLength={3}
        placeholder="—"
        onChange={(event) => onChange(event.target.value.replace(/[^A-Za-z]/g, "").toUpperCase())}
        style={{ width: "100%", height: 29, boxSizing: "border-box", padding: "0 8px", border: `1px solid ${error ? "rgba(220,38,38,.38)" : value ? "rgba(15,23,42,.14)" : "rgba(15,23,42,.08)"}`, borderRadius: 7, outline: 0, background: error ? "rgba(220,38,38,.025)" : "#fff", color: error ? RED : "#111827", fontFamily: "inherit", fontSize: 11, fontWeight: 800, textTransform: "uppercase" }}
      />
      {error ? <small style={{ color: RED, fontSize: 8, fontWeight: 650 }}>{error}</small> : (header || sample) ? (
        <small style={{ minWidth: 0, overflow: "hidden", color: "rgba(15,23,42,.35)", fontSize: 8, textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {header ? <strong style={{ color: "rgba(15,23,42,.52)" }}>{header}</strong> : null}{sample ? ` · ${sample}` : ""}
        </small>
      ) : <small style={{ height: 10 }} />}
    </label>
  );
}

export function SmMarketImportModal({ onClose, onImport }: {
  onClose: () => void;
  onImport: (input: ImportSmMarketsInput) => Promise<{ markets: SmMarketRecord[]; summary: SmMarketImportSummary }>;
}) {
  const [step, setStep] = useState<"upload" | "mapping" | "summary">("upload");
  const [workbook, setWorkbook] = useState<WorkbookResult | null>(null);
  const [fileName, setFileName] = useState("");
  const [mapping, setMapping] = useState<SmMarketColumnMapping>({});
  const [summary, setSummary] = useState<SmMarketImportSummary | null>(null);
  const [dragging, setDragging] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const preview = useMemo(() => workbook ? buildPreviewGrid(workbook.rows) : null, [workbook]);
  const validation = useMemo(() => validateMapping(mapping), [mapping]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !submitting) onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose, submitting]);

  const handleFiles = useCallback(async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    if (!/\.(xlsx|xls)$/i.test(file.name)) {
      setError("Bitte eine Excel-Datei (.xlsx oder .xls) auswählen.");
      return;
    }
    setParsing(true);
    setError(null);
    try {
      const parsed = await readWorkbook(file);
      if (parsed.rows.length < 2) throw new Error("Die Datei enthält keine Datenzeilen.");
      setWorkbook(parsed);
      setFileName(file.name);
      setMapping(suggestMapping(parsed.rows));
      setStep("mapping");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Datei konnte nicht gelesen werden.");
    } finally {
      setParsing(false);
    }
  }, []);

  const submit = useCallback(async () => {
    if (!workbook || !validation.canImport || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await onImport({ fileName, sheetName: workbook.sheetName, rows: workbook.rows, mapping });
      setSummary(result.summary);
      setStep("summary");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Import fehlgeschlagen.");
    } finally {
      setSubmitting(false);
    }
  }, [fileName, mapping, onImport, submitting, validation.canImport, workbook]);

  const restart = () => {
    setStep("upload");
    setWorkbook(null);
    setFileName("");
    setMapping({});
    setSummary(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return createPortal(
    <div onMouseDown={(event) => { if (event.target === event.currentTarget && !submitting) onClose(); }} style={{ position: "fixed", inset: 0, zIndex: 10000, padding: 24, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(15,23,42,.24)", backdropFilter: "blur(5px)" }}>
      <div role="dialog" aria-modal="true" aria-labelledby="sm-market-import-title" style={{ width: step === "mapping" ? 900 : 560, maxWidth: "calc(100vw - 32px)", maxHeight: "calc(100vh - 48px)", overflow: "hidden", display: "flex", flexDirection: "column", border: "1px solid rgba(15,23,42,.08)", borderRadius: 16, background: "#fff", boxShadow: "0 20px 65px rgba(15,23,42,.2)", transition: "width .18s ease" }}>
        <header style={{ padding: "16px 18px 13px", display: "flex", alignItems: "flex-start", gap: 11, borderBottom: "1px solid rgba(15,23,42,.06)" }}>
          <span style={{ width: 34, height: 34, flex: "0 0 34px", display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 9, background: "rgba(220,38,38,.065)", color: RED }}><Upload size={15} strokeWidth={1.9} /></span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ color: "rgba(15,23,42,.34)", fontSize: 8, fontWeight: 850, letterSpacing: ".12em", textTransform: "uppercase" }}>SM Marktimport</div>
            <h2 id="sm-market-import-title" style={{ margin: "3px 0 0", color: "#111827", fontSize: 17, fontWeight: 850, letterSpacing: "-.03em" }}>{step === "upload" ? "Excel-Datei importieren" : step === "mapping" ? "Spalten zuweisen" : "Import abgeschlossen"}</h2>
            <div style={{ marginTop: 4, color: "rgba(15,23,42,.43)", fontSize: 10 }}>{step === "mapping" ? `${fileName} · ${workbook?.sheetName} · ${Math.max((workbook?.rows.length ?? 1) - 1, 0)} Datenzeilen` : "Shelf-Merchandising-Märkte getrennt vom GM-Marktstamm importieren."}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            {(["upload", "mapping", "summary"] as const).map((value, index) => <span key={value} style={{ width: value === step ? 18 : 6, height: 5, borderRadius: 99, background: value === step ? RED : index < (["upload", "mapping", "summary"] as const).indexOf(step) ? "rgba(22,163,74,.55)" : "rgba(15,23,42,.1)", transition: "all .16s" }} />)}
          </div>
          <button type="button" onClick={onClose} disabled={submitting} aria-label="Fenster schließen" style={{ width: 28, height: 28, border: 0, borderRadius: 8, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "rgba(15,23,42,.035)", color: "rgba(15,23,42,.42)", cursor: submitting ? "not-allowed" : "pointer" }}><X size={13} strokeWidth={2.1} /></button>
        </header>

        {step === "upload" ? (
          <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 13 }}>
            <div
              role="button"
              tabIndex={0}
              aria-label="Excel-Datei auswählen oder hier ablegen"
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => { event.preventDefault(); setDragging(false); void handleFiles(event.dataTransfer.files); }}
              style={{ minHeight: 230, boxSizing: "border-box", padding: 24, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, border: `2px dashed ${dragging ? RED : "rgba(15,23,42,.1)"}`, borderRadius: 13, background: dragging ? "rgba(220,38,38,.025)" : "rgba(15,23,42,.012)", textAlign: "center", cursor: "pointer" }}
            >
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls" hidden onChange={(event) => void handleFiles(event.target.files)} />
              <span style={{ width: 48, height: 48, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 12, background: "rgba(15,23,42,.045)", color: "rgba(15,23,42,.3)" }}>{parsing ? <span style={{ width: 19, height: 19, border: `2px solid ${RED}`, borderTopColor: "transparent", borderRadius: "50%", animation: "smImportSpin .7s linear infinite" }} /> : <FileSpreadsheet size={22} strokeWidth={1.5} />}</span>
              <div><strong style={{ display: "block", color: "#17191d", fontSize: 13 }}>{parsing ? "Datei wird gelesen…" : "Excel-Datei hier ablegen"}</strong><span style={{ display: "block", marginTop: 4, color: "rgba(15,23,42,.35)", fontSize: 10 }}>oder klicken zum Auswählen · .xlsx, .xls</span></div>
            </div>
            {error ? <div role="alert" style={{ padding: "9px 11px", display: "flex", alignItems: "center", gap: 7, border: "1px solid rgba(220,38,38,.14)", borderRadius: 8, background: "rgba(220,38,38,.05)", color: RED, fontSize: 10, fontWeight: 650 }}><AlertTriangle size={12} />{error}</div> : null}
          </div>
        ) : null}

        {step === "mapping" && workbook && preview ? (
          <div style={{ minHeight: 0, flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div style={{ height: 205, overflow: "auto", borderBottom: "1px solid rgba(15,23,42,.06)" }}>
              <table style={{ minWidth: "max-content", borderCollapse: "collapse", tableLayout: "fixed", color: "#374151", fontSize: 9.5 }}>
                <thead><tr><th style={{ position: "sticky", top: 0, left: 0, zIndex: 3, width: 36, background: "#f7f7f8" }} />{preview.colLetters.map((letter) => <th key={letter} style={{ position: "sticky", top: 0, zIndex: 2, width: 112, padding: "5px 8px", borderRight: "1px solid rgba(15,23,42,.04)", borderBottom: "1px solid rgba(15,23,42,.07)", background: "#f7f7f8", color: "rgba(15,23,42,.42)", fontSize: 8.5 }}>{letter}</th>)}</tr></thead>
                <tbody>
                  {[preview.headerRow, ...preview.previewRows.slice(0, 12)].map((row, rowIndex) => <tr key={rowIndex} style={{ background: rowIndex === 0 ? "#fafafa" : rowIndex % 2 ? "#fff" : "rgba(15,23,42,.012)" }}><td style={{ position: "sticky", left: 0, zIndex: 1, width: 36, padding: "4px 6px", borderRight: "1px solid rgba(15,23,42,.06)", background: "#f7f7f8", color: "rgba(15,23,42,.25)", textAlign: "right" }}>{rowIndex + 1}</td>{preview.colLetters.map((_, columnIndex) => <td key={columnIndex} title={row[columnIndex] ?? ""} style={{ width: 112, maxWidth: 112, padding: "4px 8px", overflow: "hidden", borderRight: "1px solid rgba(15,23,42,.03)", borderBottom: "1px solid rgba(15,23,42,.035)", color: rowIndex === 0 ? "#17191d" : "#4b5563", fontWeight: rowIndex === 0 ? 700 : 500, textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row[columnIndex] || "—"}</td>)}</tr>)}
                </tbody>
              </table>
            </div>
            <div style={{ minHeight: 0, flex: 1, overflowY: "auto", padding: "15px 18px" }}>
              <div style={{ marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}><span style={{ color: "rgba(15,23,42,.34)", fontSize: 8.5, fontWeight: 850, letterSpacing: ".1em", textTransform: "uppercase" }}>Spaltenzuweisung</span><span style={{ color: "rgba(15,23,42,.32)", fontSize: 8.5 }}>Automatisch aus der Kopfzeile erkannt · manuell anpassbar</span></div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: "9px 11px" }}>
                {FIELD_SPECS.map((spec) => <MappingField key={spec.key} spec={spec} value={mapping[spec.key] ?? ""} rows={workbook.rows} error={validation.errors[spec.key] ?? validation.duplicateErrors[spec.key]} onChange={(value) => setMapping((current) => ({ ...current, [spec.key]: value }))} />)}
              </div>
              {!validation.hasIdentity ? <div style={{ marginTop: 8, color: RED, fontSize: 9.5, fontWeight: 650 }}>Mindestens Flexnummer oder Stammnummern zuweisen.</div> : null}
              {!validation.planningComplete ? <div style={{ marginTop: 8, color: RED, fontSize: 9.5, fontWeight: 650 }}>Wenn Betreuungstage oder Wochenstunden gemappt sind, müssen auch Mo bis Fr zugewiesen sein.</div> : null}
            </div>
            <footer style={{ padding: "11px 18px", display: "flex", alignItems: "center", gap: 9, borderTop: "1px solid rgba(15,23,42,.06)" }}>
              {error ? <div role="alert" style={{ minWidth: 0, flex: 1, padding: "8px 10px", display: "flex", alignItems: "flex-start", gap: 7, border: "1px solid rgba(220,38,38,.14)", borderRadius: 8, background: "rgba(220,38,38,.05)", color: RED, fontSize: 9.5, fontWeight: 650 }}><AlertTriangle size={11} style={{ flexShrink: 0 }} />{error}</div> : <div style={{ flex: 1 }} />}
              <button type="button" onClick={restart} disabled={submitting} style={{ height: 32, padding: "0 13px", border: "1px solid rgba(15,23,42,.09)", borderRadius: 8, background: "linear-gradient(#fff,#f5f5f5)", color: "rgba(15,23,42,.52)", fontFamily: "inherit", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>← Datei</button>
              <button type="button" onClick={() => void submit()} disabled={!validation.canImport || submitting} style={{ height: 32, padding: "0 16px", display: "inline-flex", alignItems: "center", gap: 6, border: 0, borderRadius: 8, background: validation.canImport && !submitting ? `linear-gradient(${RED},#b91c1c)` : "rgba(15,23,42,.14)", color: "#fff", fontFamily: "inherit", fontSize: 10.5, fontWeight: 800, cursor: validation.canImport && !submitting ? "pointer" : "not-allowed" }}><Upload size={11} />{submitting ? "Import läuft…" : "Importieren"}</button>
            </footer>
          </div>
        ) : null}

        {step === "summary" && summary ? (
          <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 15 }}>
            <div style={{ padding: 14, display: "flex", alignItems: "center", gap: 10, border: "1px solid rgba(22,163,74,.13)", borderRadius: 11, background: "rgba(22,163,74,.05)" }}><span style={{ width: 30, height: 30, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 9, background: "rgba(22,163,74,.1)", color: "#15803d" }}><Check size={15} strokeWidth={2.4} /></span><div><strong style={{ display: "block", color: "#14532d", fontSize: 12 }}>Import verarbeitet</strong><span style={{ color: "rgba(20,83,45,.62)", fontSize: 9.5 }}>{summary.fileName} · {summary.sheetName}</span></div></div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 8 }}>{[
              ["Zeilen", summary.totalParsedRows], ["Neu", summary.created], ["Aktualisiert", summary.updated], ["Unverändert", summary.unchanged], ["Übersprungen", summary.skipped],
            ].map(([label, value]) => <div key={String(label)} style={{ padding: "11px 9px", border: "1px solid rgba(15,23,42,.065)", borderRadius: 9, background: "#fafafa" }}><span style={{ display: "block", color: "rgba(15,23,42,.35)", fontSize: 7.5, fontWeight: 850, letterSpacing: ".07em", textTransform: "uppercase" }}>{label}</span><strong style={{ display: "block", marginTop: 4, color: "#17191d", fontSize: 17, fontWeight: 850 }}>{value}</strong></div>)}</div>
            {summary.skippedReasons.length > 0 ? <div style={{ maxHeight: 180, overflowY: "auto", border: "1px solid rgba(217,119,6,.13)", borderRadius: 9, background: "rgba(255,251,235,.55)" }}>{summary.skippedReasons.map((reason) => <div key={`${reason.row}-${reason.reason}`} style={{ padding: "8px 10px", display: "grid", gridTemplateColumns: "52px minmax(0,1fr)", gap: 8, borderBottom: "1px solid rgba(217,119,6,.08)", color: "#8b5a12", fontSize: 9.5 }}><strong>Zeile {reason.row}</strong><span>{reason.reason} · {reason.sample}</span></div>)}</div> : null}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}><button type="button" onClick={restart} style={{ height: 32, padding: "0 13px", border: "1px solid rgba(15,23,42,.09)", borderRadius: 8, background: "linear-gradient(#fff,#f5f5f5)", color: "rgba(15,23,42,.52)", fontFamily: "inherit", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>Weiteren Import starten</button><button type="button" onClick={onClose} style={{ height: 32, padding: "0 16px", border: 0, borderRadius: 8, background: `linear-gradient(${RED},#b91c1c)`, color: "#fff", fontFamily: "inherit", fontSize: 10.5, fontWeight: 800, cursor: "pointer" }}>Fertig</button></div>
          </div>
        ) : null}
        <style>{`@keyframes smImportSpin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>,
    document.body,
  );
}
