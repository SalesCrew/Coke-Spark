"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { Loader2, PauseCircle, PlayCircle } from "lucide-react";
import { setModuleCatalogInactive, type FragebogenScope } from "@/lib/api/backend";
import { sortCatalogModules } from "@/lib/module-catalog";
import type { Module } from "@/types/fragebogen";

// Shared between catalogs without mutating questionnaire editing contexts.
// This cache is session-only; durable state comes from the backend on reload.
let overrides: Readonly<Record<string, boolean>> = {};
const empty: Readonly<Record<string, boolean>> = {};
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const snapshot = () => overrides;
const serverSnapshot = () => empty;

export function useCatalogModules(modules: Module[], scope: FragebogenScope) {
  const state = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  return sortCatalogModules(modules.map((module) => {
    const value = state[`${scope}:${module.id}`];
    return value === undefined ? module : { ...module, catalogInactive: value };
  }));
}

export function ModuleCatalogStatusAction({ module, scope, onClose }: { module: Module; scope: FragebogenScope; onClose: () => void }) {
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const inactive = Boolean(module.catalogInactive);
  return <>
    <button type="button" role="menuitem" disabled={saving} onClick={async (event) => {
      event.stopPropagation();
      if (savingRef.current) return;
      savingRef.current = true;
      setSaving(true);
      setError(null);
      try {
        const result = await setModuleCatalogInactive(scope, module.id, !inactive);
        overrides = { ...overrides, [`${scope}:${result.id}`]: result.catalogInactive };
        listeners.forEach((listener) => listener());
        onClose();
      } catch (failure) {
        setError(failure instanceof Error ? failure.message : "Status konnte nicht gespeichert werden.");
      } finally { savingRef.current = false; setSaving(false); }
    }} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "7px 10px", border: "none", borderRadius: 6, background: "none", cursor: saving ? "wait" : "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: 500, color: "#374151", textAlign: "left" }}
      onMouseEnter={(event) => { event.currentTarget.style.backgroundColor = "rgba(0,0,0,0.03)"; }}
      onMouseLeave={(event) => { event.currentTarget.style.backgroundColor = "transparent"; }}>
      {saving ? <Loader2 size={12} className="animate-spin" /> : inactive ? <PlayCircle size={12} /> : <PauseCircle size={12} />}
      {saving ? "Wird gespeichert…" : inactive ? "Reaktivieren" : "Inaktiv setzen"}
    </button>
    {error && <div role="alert" style={{ maxWidth: 240, padding: "5px 10px", fontSize: 10, lineHeight: 1.5, color: "#DC2626" }}>{error}</div>}
  </>;
}

export function ModuleCatalogStatusBadge({ module }: { module: Module }) {
  return <>
    <style jsx global>{`
      .module-catalog-card[data-catalog-inactive="true"] > :not([data-module-overlay]) { opacity: .55; }
      .module-catalog-card > :not([data-module-overlay]) { transition: opacity .15s ease; }
    `}</style>
    {module.catalogInactive && <span style={{ fontSize: 9, fontWeight: 600, padding: "2px 7px", borderRadius: 5, background: "rgba(100,116,139,.10)", color: "#64748b", whiteSpace: "nowrap" }}>Inaktiv</span>}
  </>;
}
