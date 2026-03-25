"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { AdminSidenav } from "@/components/ui/AdminSidenav";
import { ModuleEditor } from "@/components/admin/ModuleEditor";
import { FragebogenEditor } from "@/components/admin/FragebogenEditor";
import { KuehlerModuleEditor } from "@/components/admin/KuehlerModuleEditor";
import { KuehlerFragebogenEditor } from "@/components/admin/KuehlerFragebogenEditor";
import { MhdModuleEditor } from "@/components/admin/MhdModuleEditor";
import { MhdFragebogenEditor } from "@/components/admin/MhdFragebogenEditor";
import { FlexModuleEditor } from "@/components/admin/FlexModuleEditor";
import { FlexFragebogenEditor } from "@/components/admin/FlexFragebogenEditor";
import { BillaModuleEditor } from "@/components/admin/BillaModuleEditor";
import { BillaFragebogenEditor } from "@/components/admin/BillaFragebogenEditor";
import { ModuleProvider, useModules } from "@/context/ModuleContext";
import { FragebogenProvider, useFragebogen } from "@/context/FragebogenContext";
import type { Module, Fragebogen } from "@/types/fragebogen";
import { usePathname } from "next/navigation";
import {
  KuehlerCtx, MhdCtx, FlexCtx, BillaCtx,
  type KuehlerCtxValue, type MhdCtxValue, type FlexCtxValue, type BillaCtxValue,
} from "@/app/admin/adminContexts";

// ── Purple accent colours (used by MHD) ───────────────────────

function AdminLayoutInner({ children }: { children: React.ReactNode }) {
  const { addModule, updateModule, setEditHandler: setModuleEditHandler, modules } = useModules();
  const { addFragebogen, updateFragebogen, setEditHandler: setFbEditHandler } = useFragebogen();
  const pathname = usePathname();
  const isKuehler = pathname.startsWith("/admin/kuehlerinventur");
  const isMhd = pathname.startsWith("/admin/mhd");
  const isFlex = pathname.startsWith("/admin/flexbesuche");
  const isBilla = pathname.startsWith("/admin/billa");
  const isFbManagement = pathname.startsWith("/admin/fbmanagement");
  const isFbNeu = pathname === "/admin/fbmanagement/neu";

  // ── Fragebogen-side state ──────────────────────────────────
  const [moduleEditorOpen, setModuleEditorOpen] = useState(false);
  const [editingModule, setEditingModule] = useState<Module | null>(null);
  const [fbEditorOpen, setFbEditorOpen] = useState(false);
  const [editingFb, setEditingFb] = useState<Fragebogen | null>(null);

  const openEditModule = (m: Module) => { setEditingModule(m); setModuleEditorOpen(true); };
  const openEditFb = (f: Fragebogen) => { setEditingFb(f); setFbEditorOpen(true); };

  useEffect(() => { setModuleEditHandler(openEditModule); }, [setModuleEditHandler]);
  useEffect(() => { setFbEditHandler(openEditFb); }, [setFbEditHandler]);

  const handleModuleSave = (m: Module) => {
    editingModule ? updateModule(m) : addModule(m);
    setModuleEditorOpen(false);
    setEditingModule(null);
  };
  const handleFbSave = (f: Fragebogen) => {
    editingFb ? updateFragebogen(f) : addFragebogen(f);
    setFbEditorOpen(false);
    setEditingFb(null);
  };

  // ── Kühlerinventur-side state (fully isolated) ─────────────
  const [kuehlerModules, setKuehlerModules] = useState<Module[]>([]);
  const [kuehlerModuleEditorOpen, setKuehlerModuleEditorOpen] = useState(false);
  const [kuehlerEditingModule, setKuehlerEditingModule] = useState<Module | null>(null);

  const [kuehlerFragebogenList, setKuehlerFragebogenList] = useState<Fragebogen[]>([]);
  const [kuehlerFbEditorOpen, setKuehlerFbEditorOpen] = useState(false);
  const [kuehlerEditingFb, setKuehlerEditingFb] = useState<Fragebogen | null>(null);

  const handleKuehlerModuleSave = (m: Module) => {
    setKuehlerModules((prev) => {
      const exists = prev.find((x) => x.id === m.id);
      return exists ? prev.map((x) => (x.id === m.id ? m : x)) : [m, ...prev];
    });
    setKuehlerModuleEditorOpen(false);
    setKuehlerEditingModule(null);
  };

  const handleKuehlerFbSave = (f: Fragebogen) => {
    setKuehlerFragebogenList((prev) => {
      const exists = prev.find((x) => x.id === f.id);
      return exists ? prev.map((x) => (x.id === f.id ? f : x)) : [f, ...prev];
    });
    setKuehlerFbEditorOpen(false);
    setKuehlerEditingFb(null);
  };

  const deleteKuehlerModuleKeepQuestions = (id: string) => {
    setKuehlerModules((prev) => {
      const target = prev.find((m) => m.id === id);
      if (!target || target.questions.length === 0) {
        return prev.filter((m) => m.id !== id);
      }
      const UNASSIGNED_ID = "__kuehler_unassigned__";
      const existing = prev.find((m) => m.id === UNASSIGNED_ID);
      const withoutTarget = prev.filter((m) => m.id !== id);
      if (existing) {
        return withoutTarget.map((m) =>
          m.id === UNASSIGNED_ID
            ? { ...m, questions: [...m.questions, ...target.questions] }
            : m
        );
      } else {
        return [
          ...withoutTarget,
          {
            id: UNASSIGNED_ID,
            name: "Unzugewiesen",
            description: "",
            usedInCount: 0,
            createdAt: new Date().toISOString(),
            questions: target.questions,
          },
        ];
      }
    });
  };

  const kuehlerCtxValue: KuehlerCtxValue = {
    modules: kuehlerModules,
    onEdit: (m) => { setKuehlerEditingModule(m); setKuehlerModuleEditorOpen(true); },
    onUpdate: (m) => setKuehlerModules((prev) => prev.map((x) => (x.id === m.id ? m : x))),
    onDelete: deleteKuehlerModuleKeepQuestions,
    onDuplicate: (m) => setKuehlerModules((prev) => [
      { ...m, id: `kmod-dup-${Date.now()}`, name: `Kopie von ${m.name}`, createdAt: new Date().toISOString(), questions: m.questions },
      ...prev,
    ]),
    fragebogenList: kuehlerFragebogenList,
    onEditFb: (f) => { setKuehlerEditingFb(f); setKuehlerFbEditorOpen(true); },
    onDeleteFb: (id) => setKuehlerFragebogenList((prev) => prev.filter((x) => x.id !== id)),
    onDuplicateFb: (f) => setKuehlerFragebogenList((prev) => [
      { ...f, id: `kfb-dup-${Date.now()}`, name: `Kopie von ${f.name}`, createdAt: new Date().toISOString(), status: "inactive" },
      ...prev,
    ]),
  };

  // ── MHD-side state (fully isolated) ───────────────────────────
  const [mhdModules, setMhdModules] = useState<Module[]>([]);
  const [mhdModuleEditorOpen, setMhdModuleEditorOpen] = useState(false);
  const [mhdEditingModule, setMhdEditingModule] = useState<Module | null>(null);

  const [mhdFragebogenList, setMhdFragebogenList] = useState<Fragebogen[]>([]);
  const [mhdFbEditorOpen, setMhdFbEditorOpen] = useState(false);
  const [mhdEditingFb, setMhdEditingFb] = useState<Fragebogen | null>(null);

  const handleMhdModuleSave = (m: Module) => {
    setMhdModules((prev) => {
      const exists = prev.find((x) => x.id === m.id);
      return exists ? prev.map((x) => (x.id === m.id ? m : x)) : [m, ...prev];
    });
    setMhdModuleEditorOpen(false);
    setMhdEditingModule(null);
  };

  const handleMhdFbSave = (f: Fragebogen) => {
    setMhdFragebogenList((prev) => {
      const exists = prev.find((x) => x.id === f.id);
      return exists ? prev.map((x) => (x.id === f.id ? f : x)) : [f, ...prev];
    });
    setMhdFbEditorOpen(false);
    setMhdEditingFb(null);
  };

  const deleteMhdModuleKeepQuestions = (id: string) => {
    setMhdModules((prev) => {
      const target = prev.find((m) => m.id === id);
      if (!target || target.questions.length === 0) {
        return prev.filter((m) => m.id !== id);
      }
      const UNASSIGNED_ID = "__mhd_unassigned__";
      const existing = prev.find((m) => m.id === UNASSIGNED_ID);
      const withoutTarget = prev.filter((m) => m.id !== id);
      if (existing) {
        return withoutTarget.map((m) =>
          m.id === UNASSIGNED_ID
            ? { ...m, questions: [...m.questions, ...target.questions] }
            : m
        );
      } else {
        return [
          ...withoutTarget,
          {
            id: UNASSIGNED_ID,
            name: "Unzugewiesen",
            description: "",
            usedInCount: 0,
            createdAt: new Date().toISOString(),
            questions: target.questions,
          },
        ];
      }
    });
  };

  const mhdCtxValue: MhdCtxValue = {
    modules: mhdModules,
    onEdit: (m) => { setMhdEditingModule(m); setMhdModuleEditorOpen(true); },
    onUpdate: (m) => setMhdModules((prev) => prev.map((x) => (x.id === m.id ? m : x))),
    onDelete: deleteMhdModuleKeepQuestions,
    onDuplicate: (m) => setMhdModules((prev) => [
      { ...m, id: `mmod-dup-${Date.now()}`, name: `Kopie von ${m.name}`, createdAt: new Date().toISOString(), questions: m.questions },
      ...prev,
    ]),
    fragebogenList: mhdFragebogenList,
    onEditFb: (f) => { setMhdEditingFb(f); setMhdFbEditorOpen(true); },
    onDeleteFb: (id) => setMhdFragebogenList((prev) => prev.filter((x) => x.id !== id)),
    onDuplicateFb: (f) => setMhdFragebogenList((prev) => [
      { ...f, id: `mfb-dup-${Date.now()}`, name: `Kopie von ${f.name}`, createdAt: new Date().toISOString(), status: "inactive" },
      ...prev,
    ]),
  };

  // ── Flexbesuche-side state (modules isolated; fragebogen isolated; questions shared via flat view) ──
  const [flexModules, setFlexModules] = useState<Module[]>([]);
  const [flexModuleEditorOpen, setFlexModuleEditorOpen] = useState(false);
  const [flexEditingModule, setFlexEditingModule] = useState<Module | null>(null);

  const [flexFragebogenList, setFlexFragebogenList] = useState<Fragebogen[]>([]);
  const [flexFbEditorOpen, setFlexFbEditorOpen] = useState(false);
  const [flexEditingFb, setFlexEditingFb] = useState<Fragebogen | null>(null);

  const handleFlexModuleSave = (m: Module) => {
    setFlexModules((prev) => {
      const exists = prev.find((x) => x.id === m.id);
      return exists ? prev.map((x) => (x.id === m.id ? m : x)) : [m, ...prev];
    });
    setFlexModuleEditorOpen(false);
    setFlexEditingModule(null);
  };

  const handleFlexFbSave = (f: Fragebogen) => {
    setFlexFragebogenList((prev) => {
      const exists = prev.find((x) => x.id === f.id);
      return exists ? prev.map((x) => (x.id === f.id ? f : x)) : [f, ...prev];
    });
    setFlexFbEditorOpen(false);
    setFlexEditingFb(null);
  };

  const deleteFlexModuleKeepQuestions = (id: string) => {
    setFlexModules((prev) => {
      const target = prev.find((m) => m.id === id);
      if (!target || target.questions.length === 0) {
        return prev.filter((m) => m.id !== id);
      }
      const UNASSIGNED_ID = "__flex_unassigned__";
      const existing = prev.find((m) => m.id === UNASSIGNED_ID);
      const withoutTarget = prev.filter((m) => m.id !== id);
      if (existing) {
        return withoutTarget.map((m) =>
          m.id === UNASSIGNED_ID
            ? { ...m, questions: [...m.questions, ...target.questions] }
            : m
        );
      } else {
        return [
          ...withoutTarget,
          {
            id: UNASSIGNED_ID,
            name: "Unzugewiesen",
            description: "",
            usedInCount: 0,
            createdAt: new Date().toISOString(),
            questions: target.questions,
          },
        ];
      }
    });
  };

  const flexCtxValue: FlexCtxValue = {
    modules: flexModules,
    onEdit: (m) => { setFlexEditingModule(m); setFlexModuleEditorOpen(true); },
    onUpdate: (m) => setFlexModules((prev) => prev.map((x) => (x.id === m.id ? m : x))),
    onDelete: deleteFlexModuleKeepQuestions,
    onDuplicate: (m) => setFlexModules((prev) => [
      { ...m, id: `fxmod-dup-${Date.now()}`, name: `Kopie von ${m.name}`, createdAt: new Date().toISOString(), questions: m.questions },
      ...prev,
    ]),
    fragebogenList: flexFragebogenList,
    onEditFb: (f) => { setFlexEditingFb(f); setFlexFbEditorOpen(true); },
    onDeleteFb: (id) => setFlexFragebogenList((prev) => prev.filter((x) => x.id !== id)),
    onDuplicateFb: (f) => setFlexFragebogenList((prev) => [
      { ...f, id: `fxfb-dup-${Date.now()}`, name: `Kopie von ${f.name}`, createdAt: new Date().toISOString(), status: "inactive" },
      ...prev,
    ]),
    duplicateFbToFlex: (f) => {
      // Copy any modules referenced by the fragebogen into Flex modules (skip already present)
      const referencedModules = f.moduleIds
        .map((id) => modules.find((m) => m.id === id))
        .filter((m): m is Module => !!m);
      if (referencedModules.length > 0) {
        setFlexModules((prev) => {
          const newModules = referencedModules.filter((m) => !prev.some((x) => x.id === m.id));
          return newModules.length > 0 ? [...newModules, ...prev] : prev;
        });
      }
      // Copy the fragebogen itself
      setFlexFragebogenList((prev) => [
        { ...f, id: `fxfb-from-std-${Date.now()}`, name: `Kopie von ${f.name}`, createdAt: new Date().toISOString(), status: "inactive" },
        ...prev,
      ]);
    },
    duplicateFbToStd: (f) => {
      const referencedModules = f.moduleIds
        .map((id) => flexModules.find((m) => m.id === id))
        .filter((m): m is Module => !!m);
      referencedModules.forEach((m) => {
        if (!modules.find((x) => x.id === m.id)) {
          addModule({ ...m, id: `fxmod-to-std-${Date.now()}-${m.id}` });
        }
      });
      addFragebogen({ ...f, id: `fb-from-flex-${Date.now()}`, name: `Kopie von ${f.name}`, createdAt: new Date().toISOString(), status: "inactive" });
    },
    duplicateFbToBilla: (f) => {
      const referencedModules = f.moduleIds
        .map((id) => flexModules.find((m) => m.id === id))
        .filter((m): m is Module => !!m);
      if (referencedModules.length > 0) {
        setBillaModules((prev) => {
          const newMods = referencedModules.filter((m) => !prev.some((x) => x.id === m.id));
          return newMods.length > 0 ? [...newMods, ...prev] : prev;
        });
      }
      setBillaFragebogenList((prev) => [
        { ...f, id: `bfb-from-flex-${Date.now()}`, name: `Kopie von ${f.name}`, createdAt: new Date().toISOString(), status: "inactive" },
        ...prev,
      ]);
    },
  };

  // ── Billa-side state (modules isolated; fragebogen isolated; questions shared) ──
  const [billaModules, setBillaModules] = useState<Module[]>([]);
  const [billaModuleEditorOpen, setBillaModuleEditorOpen] = useState(false);
  const [billaEditingModule, setBillaEditingModule] = useState<Module | null>(null);

  const [billaFragebogenList, setBillaFragebogenList] = useState<Fragebogen[]>([]);
  const [billaFbEditorOpen, setBillaFbEditorOpen] = useState(false);
  const [billaEditingFb, setBillaEditingFb] = useState<Fragebogen | null>(null);

  const handleBillaModuleSave = (m: Module) => {
    setBillaModules((prev) => {
      const exists = prev.find((x) => x.id === m.id);
      return exists ? prev.map((x) => (x.id === m.id ? m : x)) : [m, ...prev];
    });
    setBillaModuleEditorOpen(false);
    setBillaEditingModule(null);
  };

  const handleBillaFbSave = (f: Fragebogen) => {
    setBillaFragebogenList((prev) => {
      const exists = prev.find((x) => x.id === f.id);
      return exists ? prev.map((x) => (x.id === f.id ? f : x)) : [f, ...prev];
    });
    setBillaFbEditorOpen(false);
    setBillaEditingFb(null);
  };

  const deleteBillaModuleKeepQuestions = (id: string) => {
    setBillaModules((prev) => {
      const target = prev.find((m) => m.id === id);
      if (!target || target.questions.length === 0) {
        return prev.filter((m) => m.id !== id);
      }
      const UNASSIGNED_ID = "__billa_unassigned__";
      const existing = prev.find((m) => m.id === UNASSIGNED_ID);
      const withoutTarget = prev.filter((m) => m.id !== id);
      if (existing) {
        return withoutTarget.map((m) =>
          m.id === UNASSIGNED_ID
            ? { ...m, questions: [...m.questions, ...target.questions] }
            : m
        );
      } else {
        return [
          ...withoutTarget,
          {
            id: UNASSIGNED_ID,
            name: "Unzugewiesen",
            description: "",
            usedInCount: 0,
            createdAt: new Date().toISOString(),
            questions: target.questions,
          },
        ];
      }
    });
  };

  const billaCtxValue: BillaCtxValue = {
    modules: billaModules,
    onEdit: (m) => { setBillaEditingModule(m); setBillaModuleEditorOpen(true); },
    onUpdate: (m) => setBillaModules((prev) => prev.map((x) => (x.id === m.id ? m : x))),
    onDelete: deleteBillaModuleKeepQuestions,
    onDuplicate: (m) => setBillaModules((prev) => [
      { ...m, id: `bmod-dup-${Date.now()}`, name: `Kopie von ${m.name}`, createdAt: new Date().toISOString(), questions: m.questions },
      ...prev,
    ]),
    fragebogenList: billaFragebogenList,
    onEditFb: (f) => { setBillaEditingFb(f); setBillaFbEditorOpen(true); },
    onDeleteFb: (id) => setBillaFragebogenList((prev) => prev.filter((x) => x.id !== id)),
    onDuplicateFb: (f) => setBillaFragebogenList((prev) => [
      { ...f, id: `bfb-dup-${Date.now()}`, name: `Kopie von ${f.name}`, createdAt: new Date().toISOString(), status: "inactive" },
      ...prev,
    ]),
    duplicateFbToStd: (f) => {
      const referencedModules = f.moduleIds
        .map((id) => billaModules.find((m) => m.id === id))
        .filter((m): m is Module => !!m);
      // Add modules not already in std
      referencedModules.forEach((m) => {
        if (!modules.find((x) => x.id === m.id)) {
          addModule({ ...m, id: `bmod-to-std-${Date.now()}-${m.id}` });
        }
      });
      addFragebogen({ ...f, id: `fb-from-billa-${Date.now()}`, name: `Kopie von ${f.name}`, createdAt: new Date().toISOString(), status: "inactive" });
    },
    duplicateFbToFlex: (f) => {
      const referencedModules = f.moduleIds
        .map((id) => billaModules.find((m) => m.id === id))
        .filter((m): m is Module => !!m);
      if (referencedModules.length > 0) {
        setFlexModules((prev) => {
          const newMods = referencedModules.filter((m) => !prev.some((x) => x.id === m.id));
          return newMods.length > 0 ? [...newMods, ...prev] : prev;
        });
      }
      setFlexFragebogenList((prev) => [
        { ...f, id: `fxfb-from-billa-${Date.now()}`, name: `Kopie von ${f.name}`, createdAt: new Date().toISOString(), status: "inactive" },
        ...prev,
      ]);
    },
    duplicateFbToBilla: (f) => {
      // This allows other pages to copy a fragebogen into Billa
      const referencedStdModules = f.moduleIds
        .map((id) => modules.find((m) => m.id === id))
        .filter((m): m is Module => !!m);
      const referencedFlexModules = f.moduleIds
        .map((id) => flexModules.find((m) => m.id === id))
        .filter((m): m is Module => !!m);
      const allReferenced = [...referencedStdModules, ...referencedFlexModules];
      if (allReferenced.length > 0) {
        setBillaModules((prev) => {
          const newMods = allReferenced.filter((m) => !prev.some((x) => x.id === m.id));
          return newMods.length > 0 ? [...newMods, ...prev] : prev;
        });
      }
      setBillaFragebogenList((prev) => [
        { ...f, id: `bfb-from-other-${Date.now()}`, name: `Kopie von ${f.name}`, createdAt: new Date().toISOString(), status: "inactive" },
        ...prev,
      ]);
    },
  };

  const pageTitle = isMhd ? "MHD" : isKuehler ? "Kühlerinventur" : isFlex ? "Flexbesuche" : isBilla ? "Billa" : isFbNeu ? "Neue Kampagne" : isFbManagement ? "FB Management" : "Standartbesuch";
  const pageSubtitle = isMhd
    ? "MHD-Module und Fragebogen verwalten."
    : isKuehler
    ? "Kühlerinventur-Module und Fragebogen verwalten."
    : isFlex
    ? "Flexible Besuchsfragebögen verwalten."
    : isBilla
    ? "Billa-Besuchsfragebögen verwalten."
    : isFbManagement
    ? ""
    : "Fragen, Module und Fragebogen verwalten.";

  return (
    <BillaCtx.Provider value={billaCtxValue}>
    <FlexCtx.Provider value={flexCtxValue}>
    <MhdCtx.Provider value={mhdCtxValue}>
    <KuehlerCtx.Provider value={kuehlerCtxValue}>
      <div style={{ display: "flex", minHeight: "100vh", backgroundColor: "#f5f5f7" }}>
        <AdminSidenav />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          <header style={{ height: 80, backgroundColor: "#ffffff", borderBottom: "1px solid rgba(0,0,0,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 28px", flexShrink: 0 }}>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1a1a1a", letterSpacing: "-0.02em", margin: 0 }}>{pageTitle}</h1>
              <p style={{ fontSize: 12, color: "#9ca3af", fontWeight: 400, margin: 0, marginTop: 4 }}>{pageSubtitle}</p>
            </div>

            {/* Action buttons */}
            <div style={{ display: "flex", gap: 10 }}>
              {isMhd ? (
                <>
                  <button
                    onClick={() => { setMhdEditingModule(null); setMhdModuleEditorOpen(true); }}
                    style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 16px", fontSize: 11, fontWeight: 600, color: "#ffffff", background: "linear-gradient(to bottom, #2a2a2a, #1a1a1a)", border: "none", borderRadius: 7, cursor: "pointer", transition: "all 0.15s ease", letterSpacing: "0.01em", boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.18), inset 0 -1px 0 rgba(255,255,255,0.06), 0 0 0 1px #111111, 0 1px 6px rgba(0,0,0,0.18)" }}
                  >
                    <Plus size={12} strokeWidth={2} />
                    Modul erstellen
                  </button>
                  <button
                    onClick={() => { setMhdEditingFb(null); setMhdFbEditorOpen(true); }}
                    style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 16px", fontSize: 11, fontWeight: 600, color: "#ffffff", background: "linear-gradient(to bottom, #8b5cf6, #7C3AED)", border: "none", borderRadius: 7, cursor: "pointer", transition: "all 0.15s ease", letterSpacing: "0.01em", boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.33), inset 0 -1px 0 rgba(255,255,255,0.15), 0 0 0 1px #6d28d9, 0 1px 6px rgba(124,58,237,0.25)" }}
                  >
                    <Plus size={12} strokeWidth={2} />
                    Fragebogen erstellen
                  </button>
                </>
              ) : isKuehler ? (
                <>
                  <button
                    onClick={() => { setKuehlerEditingModule(null); setKuehlerModuleEditorOpen(true); }}
                    style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 16px", fontSize: 11, fontWeight: 600, color: "#ffffff", background: "linear-gradient(to bottom, #2a2a2a, #1a1a1a)", border: "none", borderRadius: 7, cursor: "pointer", transition: "all 0.15s ease", letterSpacing: "0.01em", boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.18), inset 0 -1px 0 rgba(255,255,255,0.06), 0 0 0 1px #111111, 0 1px 6px rgba(0,0,0,0.18)" }}
                  >
                    <Plus size={12} strokeWidth={2} />
                    Modul erstellen
                  </button>
                  <button
                    onClick={() => { setKuehlerEditingFb(null); setKuehlerFbEditorOpen(true); }}
                    style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 16px", fontSize: 11, fontWeight: 600, color: "#ffffff", background: "linear-gradient(to bottom, #F59E0B, #D97706)", border: "none", borderRadius: 7, cursor: "pointer", transition: "all 0.15s ease", letterSpacing: "0.01em", boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.33), inset 0 -1px 0 rgba(255,255,255,0.15), 0 0 0 1px #B45309, 0 1px 6px rgba(245,158,11,0.25)" }}
                  >
                    <Plus size={12} strokeWidth={2} />
                    Fragebogen erstellen
                  </button>
                </>
              ) : isFlex ? (
                <>
                  <button
                    onClick={() => { setFlexEditingModule(null); setFlexModuleEditorOpen(true); }}
                    style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 16px", fontSize: 11, fontWeight: 600, color: "#ffffff", background: "linear-gradient(to bottom, #2a2a2a, #1a1a1a)", border: "none", borderRadius: 7, cursor: "pointer", transition: "all 0.15s ease", letterSpacing: "0.01em", boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.18), inset 0 -1px 0 rgba(255,255,255,0.06), 0 0 0 1px #111111, 0 1px 6px rgba(0,0,0,0.18)" }}
                  >
                    <Plus size={12} strokeWidth={2} />
                    Modul erstellen
                  </button>
                  <button
                    onClick={() => { setFlexEditingFb(null); setFlexFbEditorOpen(true); }}
                    style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 16px", fontSize: 11, fontWeight: 600, color: "#ffffff", background: "linear-gradient(to bottom, #84CC16, #65a30d)", border: "none", borderRadius: 7, cursor: "pointer", transition: "all 0.15s ease", letterSpacing: "0.01em", boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.33), inset 0 -1px 0 rgba(255,255,255,0.15), 0 0 0 1px #4d7c0f, 0 1px 6px rgba(132,204,22,0.25)" }}
                  >
                    <Plus size={12} strokeWidth={2} />
                    Fragebogen erstellen
                  </button>
                </>
              ) : isBilla ? (
                <>
                  <button
                    onClick={() => { setBillaEditingModule(null); setBillaModuleEditorOpen(true); }}
                    style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 16px", fontSize: 11, fontWeight: 600, color: "#ffffff", background: "linear-gradient(to bottom, #2a2a2a, #1a1a1a)", border: "none", borderRadius: 7, cursor: "pointer", transition: "all 0.15s ease", letterSpacing: "0.01em", boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.18), inset 0 -1px 0 rgba(255,255,255,0.06), 0 0 0 1px #111111, 0 1px 6px rgba(0,0,0,0.18)" }}
                  >
                    <Plus size={12} strokeWidth={2} />
                    Modul erstellen
                  </button>
                  <button
                    onClick={() => { setBillaEditingFb(null); setBillaFbEditorOpen(true); }}
                    style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 16px", fontSize: 11, fontWeight: 600, color: "#ffffff", background: "linear-gradient(to bottom, #0891B2, #0e7490)", border: "none", borderRadius: 7, cursor: "pointer", transition: "all 0.15s ease", letterSpacing: "0.01em", boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.33), inset 0 -1px 0 rgba(255,255,255,0.15), 0 0 0 1px #155e75, 0 1px 6px rgba(8,145,178,0.25)" }}
                  >
                    <Plus size={12} strokeWidth={2} />
                    Fragebogen erstellen
                  </button>
                </>
              ) : isFbNeu ? (
                <Link href="/admin/fbmanagement" style={{ textDecoration: "none" }}>
                  <button
                    style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 16px", fontSize: 11, fontWeight: 600, color: "rgba(0,0,0,0.5)", background: "linear-gradient(to bottom, #ffffff, #f5f5f5)", border: "none", borderRadius: 7, cursor: "pointer", transition: "all 0.15s ease", letterSpacing: "0.01em", boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.9), inset 0 -1px 0 rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.07)" }}
                  >
                    ← Zurück
                  </button>
                </Link>
              ) : isFbManagement ? (
                <Link href="/admin/fbmanagement/neu" style={{ textDecoration: "none" }}>
                  <button
                    style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 16px", fontSize: 11, fontWeight: 600, color: "#ffffff", background: "linear-gradient(to bottom, #DC2626, #b91c1c)", border: "none", borderRadius: 7, cursor: "pointer", transition: "all 0.15s ease", letterSpacing: "0.01em", boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.33), inset 0 -1px 0 rgba(255,255,255,0.15), 0 0 0 1px #a91b1b, 0 1px 6px rgba(180,20,20,0.14)" }}
                  >
                    <Plus size={12} strokeWidth={2} />
                    Neue Kampagne
                  </button>
                </Link>
              ) : (
                <>
                  <button
                    onClick={() => { setEditingModule(null); setModuleEditorOpen(true); }}
                    style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 16px", fontSize: 11, fontWeight: 600, color: "#ffffff", background: "linear-gradient(to bottom, #2a2a2a, #1a1a1a)", border: "none", borderRadius: 7, cursor: "pointer", transition: "all 0.15s ease", letterSpacing: "0.01em", boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.18), inset 0 -1px 0 rgba(255,255,255,0.06), 0 0 0 1px #111111, 0 1px 6px rgba(0,0,0,0.18)" }}
                  >
                    <Plus size={12} strokeWidth={2} />
                    Modul erstellen
                  </button>
                  <button
                    onClick={() => { setEditingFb(null); setFbEditorOpen(true); }}
                    style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 16px", fontSize: 11, fontWeight: 600, color: "#ffffff", background: "linear-gradient(to bottom, #DC2626, #b91c1c)", border: "none", borderRadius: 7, cursor: "pointer", transition: "all 0.15s ease", letterSpacing: "0.01em", boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.33), inset 0 -1px 0 rgba(255,255,255,0.15), 0 0 0 1px #a91b1b, 0 1px 6px rgba(180,20,20,0.14)" }}
                  >
                    <Plus size={12} strokeWidth={2} />
                    Fragebogen erstellen
                  </button>
                </>
              )}
            </div>
          </header>

          <main style={{ flex: 1, padding: 28 }}>
            {children}
          </main>
        </div>

        {/* Fragebogen modals */}
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

        {/* Kühlerinventur modals — completely isolated */}
        {kuehlerModuleEditorOpen && (
          <KuehlerModuleEditor
            existingModule={kuehlerEditingModule ?? undefined}
            onSave={handleKuehlerModuleSave}
            onClose={() => { setKuehlerModuleEditorOpen(false); setKuehlerEditingModule(null); }}
          />
        )}
        {kuehlerFbEditorOpen && (
          <KuehlerFragebogenEditor
            existingFragebogen={kuehlerEditingFb ?? undefined}
            availableModules={kuehlerModules}
            onSave={handleKuehlerFbSave}
            onClose={() => { setKuehlerFbEditorOpen(false); setKuehlerEditingFb(null); }}
          />
        )}

        {/* MHD modals — completely isolated */}
        {mhdModuleEditorOpen && (
          <MhdModuleEditor
            existingModule={mhdEditingModule ?? undefined}
            onSave={handleMhdModuleSave}
            onClose={() => { setMhdModuleEditorOpen(false); setMhdEditingModule(null); }}
          />
        )}
        {mhdFbEditorOpen && (
          <MhdFragebogenEditor
            existingFragebogen={mhdEditingFb ?? undefined}
            availableModules={mhdModules}
            onSave={handleMhdFbSave}
            onClose={() => { setMhdFbEditorOpen(false); setMhdEditingFb(null); }}
          />
        )}

        {/* Flexbesuche modals — completely isolated */}
        {flexModuleEditorOpen && (
          <FlexModuleEditor
            existingModule={flexEditingModule ?? undefined}
            onSave={handleFlexModuleSave}
            onClose={() => { setFlexModuleEditorOpen(false); setFlexEditingModule(null); }}
          />
        )}
        {flexFbEditorOpen && (
          <FlexFragebogenEditor
            existingFragebogen={flexEditingFb ?? undefined}
            availableModules={flexModules}
            onSave={handleFlexFbSave}
            onClose={() => { setFlexFbEditorOpen(false); setFlexEditingFb(null); }}
          />
        )}

        {/* Billa modals — completely isolated */}
        {billaModuleEditorOpen && (
          <BillaModuleEditor
            existingModule={billaEditingModule ?? undefined}
            onSave={handleBillaModuleSave}
            onClose={() => { setBillaModuleEditorOpen(false); setBillaEditingModule(null); }}
          />
        )}
        {billaFbEditorOpen && (
          <BillaFragebogenEditor
            existingFragebogen={billaEditingFb ?? undefined}
            availableModules={billaModules}
            onSave={handleBillaFbSave}
            onClose={() => { setBillaFbEditorOpen(false); setBillaEditingFb(null); }}
          />
        )}
      </div>
    </KuehlerCtx.Provider>
    </MhdCtx.Provider>
    </FlexCtx.Provider>
    </BillaCtx.Provider>
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
