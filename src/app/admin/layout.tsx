"use client";

import { useState, useEffect } from "react";
import { Plus } from "lucide-react";
import { AdminSidenav } from "@/components/ui/AdminSidenav";
import { ModuleEditor } from "@/components/admin/ModuleEditor";
import { FragebogenEditor } from "@/components/admin/FragebogenEditor";
import { ModuleProvider, useModules } from "@/context/ModuleContext";
import { FragebogenProvider, useFragebogen } from "@/context/FragebogenContext";
import type { Module, Fragebogen } from "@/types/fragebogen";

function AdminLayoutInner({ children }: { children: React.ReactNode }) {
  const { addModule, updateModule, setEditHandler: setModuleEditHandler, modules } = useModules();
  const { addFragebogen, updateFragebogen, setEditHandler: setFbEditHandler } = useFragebogen();

  const [moduleEditorOpen, setModuleEditorOpen] = useState(false);
  const [editingModule, setEditingModule] = useState<Module | null>(null);

  const [fbEditorOpen, setFbEditorOpen] = useState(false);
  const [editingFb, setEditingFb] = useState<Fragebogen | null>(null);

  const openNewModule = () => {
    setEditingModule(null);
    setModuleEditorOpen(true);
  };

  const openEditModule = (m: Module) => {
    setEditingModule(m);
    setModuleEditorOpen(true);
  };

  const openNewFb = () => {
    setEditingFb(null);
    setFbEditorOpen(true);
  };

  const openEditFb = (f: Fragebogen) => {
    setEditingFb(f);
    setFbEditorOpen(true);
  };

  useEffect(() => {
    setModuleEditHandler(openEditModule);
  }, [setModuleEditHandler]);

  useEffect(() => {
    setFbEditHandler(openEditFb);
  }, [setFbEditHandler]);

  const handleModuleSave = (m: Module) => {
    if (editingModule) {
      updateModule(m);
    } else {
      addModule(m);
    }
    setModuleEditorOpen(false);
    setEditingModule(null);
  };

  const handleFbSave = (f: Fragebogen) => {
    if (editingFb) {
      updateFragebogen(f);
    } else {
      addFragebogen(f);
    }
    setFbEditorOpen(false);
    setEditingFb(null);
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", backgroundColor: "#f5f5f7" }}>
      <AdminSidenav />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <header
          style={{
            height: 80,
            backgroundColor: "#ffffff",
            borderBottom: "1px solid rgba(0,0,0,0.06)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 28px",
            flexShrink: 0,
          }}
        >
          <div>
            <h1
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: "#1a1a1a",
                letterSpacing: "-0.02em",
                margin: 0,
              }}
            >
              Fragebogen
            </h1>
            <p
              style={{
                fontSize: 12,
                color: "#9ca3af",
                fontWeight: 400,
                margin: 0,
                marginTop: 4,
              }}
            >
              Fragen, Module und Fragebogen verwalten.
            </p>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={openNewModule}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                padding: "7px 16px",
                fontSize: 11,
                fontWeight: 600,
                color: "#ffffff",
                background: "linear-gradient(to bottom, #2a2a2a, #1a1a1a)",
                border: "none",
                borderRadius: 7,
                cursor: "pointer",
                transition: "all 0.15s ease",
                letterSpacing: "0.01em",
                boxShadow:
                  "inset 0 1px 0.6px rgba(255,255,255,0.18), inset 0 -1px 0 rgba(255,255,255,0.06), 0 0 0 1px #111111, 0 1px 6px rgba(0,0,0,0.18)",
              }}
            >
              <Plus size={12} strokeWidth={2} />
              Modul erstellen
            </button>
            <button
              onClick={openNewFb}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                padding: "7px 16px",
                fontSize: 11,
                fontWeight: 600,
                color: "#ffffff",
                background: "linear-gradient(to bottom, #DC2626, #b91c1c)",
                border: "none",
                borderRadius: 7,
                cursor: "pointer",
                transition: "all 0.15s ease",
                letterSpacing: "0.01em",
                boxShadow:
                  "inset 0 1px 0.6px rgba(255,255,255,0.33), inset 0 -1px 0 rgba(255,255,255,0.15), 0 0 0 1px #a91b1b, 0 1px 6px rgba(180,20,20,0.14)",
              }}
            >
              <Plus size={12} strokeWidth={2} />
              Fragebogen erstellen
            </button>
          </div>
        </header>

        <main style={{ flex: 1, padding: 28 }}>
          {children}
        </main>
      </div>

      {moduleEditorOpen && (
        <ModuleEditor
          existingModule={editingModule ?? undefined}
          onSave={handleModuleSave}
          onClose={() => { setModuleEditorOpen(false); setEditingModule(null); }}
        />
      )}

      {fbEditorOpen && (
        <FragebogenEditor
          existingFragebogen={editingFb ?? undefined}
          availableModules={modules}
          onSave={handleFbSave}
          onClose={() => { setFbEditorOpen(false); setEditingFb(null); }}
        />
      )}
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <ModuleProvider>
      <FragebogenProvider>
        <AdminLayoutInner>{children}</AdminLayoutInner>
      </FragebogenProvider>
    </ModuleProvider>
  );
}
