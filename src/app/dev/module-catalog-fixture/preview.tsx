"use client";
import { useEffect, useRef, useState } from "react";
import { ModuleProvider, useModules } from "@/context/ModuleContext";
import { FragebogenProvider } from "@/context/FragebogenContext";
import StandardCatalog from "@/app/admin/fragebogen/page";
import { ModuleEditor } from "@/components/admin/ModuleEditor";
import { fetchModules, saveAuthSession } from "@/lib/api/backend";
import type { Module } from "@/types/fragebogen";

function Preview() {
  const { addModule, updateModule, setEditHandler } = useModules();
  const initialized = useRef(false);
  const [ready, setReady] = useState(false);
  const [editing, setEditing] = useState<Module | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    if (window.location.hostname !== "localhost" || process.env.NEXT_PUBLIC_BACKEND_URL !== "http://localhost:4018") {
      setError("This fixture requires localhost:3018 and the isolated backend on 4018.");
      return;
    }
    saveAuthSession({ user: { id: "11111111-1111-4111-8111-111111111111", role: "admin", email: "synthetic@example.invalid", firstName: "Local", lastName: "Test" }, session: { accessToken: "local-module-preview", refreshToken: "local-module-preview", expiresAt: Math.floor(Date.now() / 1000) + 86400 } }, { remember: false });
    setEditHandler((module) => setEditing(module));
    void fetchModules("main").then(async (rows) => {
      for (const module of [...rows].reverse()) await addModule(module, { persist: false });
      setReady(true);
    }).catch((failure: Error) => setError(failure.message));
  }, [addModule, setEditHandler]);
  if (error) return <p role="alert">{error}</p>;
  return <div style={{ padding: 24, background: "#f5f5f7", minHeight: "100vh" }}>
    <p style={{ fontSize: 11, color: "#64748b" }}>Isolierter lokaler Test · synthetische Module · keine Produktionsdaten</p>
    {ready ? <StandardCatalog /> : <p>Laden…</p>}
    {editing && <ModuleEditor existingModule={editing} onClose={() => setEditing(null)} onSave={async (module) => { await updateModule(module); setEditing(null); }} />}
  </div>;
}
export function ModuleCatalogFixture() {
  return <ModuleProvider><FragebogenProvider><Preview /></FragebogenProvider></ModuleProvider>;
}
