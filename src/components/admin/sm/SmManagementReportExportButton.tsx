"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { FileSpreadsheet, LoaderCircle } from "lucide-react";
import styles from "./SmFbManagementWorkspace.module.css";

export const smReportEvents = {
  request: "admin:sm-fbmanagement:export",
  state: "admin:sm-fbmanagement:export-state",
  requestState: "admin:sm-fbmanagement:export-request-state",
} as const;
export type SmReportExportState = { disabled: boolean; busy: boolean };

/** Uses the admin header's existing export control geometry and page-specific state. */
export function SmManagementReportExportButton({ style }: { style: CSSProperties }) {
  const [state, setState] = useState<SmReportExportState>({ disabled: true, busy: false });
  useEffect(() => {
    const update = (event: Event) => setState((event as CustomEvent<SmReportExportState>).detail);
    window.addEventListener(smReportEvents.state, update);
    window.dispatchEvent(new Event(smReportEvents.requestState));
    return () => window.removeEventListener(smReportEvents.state, update);
  }, []);
  return <button type="button" style={{ ...style, opacity: state.disabled ? .5 : 1, cursor: state.disabled ? "default" : "pointer" }}
    disabled={state.disabled} aria-busy={state.busy} title="Alle Treffer der aktuellen Filter mit Zeiten, Antworten, Kommentaren und Fotoangaben als Excel exportieren"
    onClick={() => window.dispatchEvent(new Event(smReportEvents.request))}>
    {state.busy ? <LoaderCircle size={12} aria-hidden="true" className={styles.spin} /> : <FileSpreadsheet size={12} strokeWidth={2} aria-hidden="true" />}
    {state.busy ? "Wird exportiert …" : "Komplettauswertung"}
  </button>;
}
