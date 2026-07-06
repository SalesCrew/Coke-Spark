"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { Plus, Download, FileSpreadsheet } from "lucide-react";
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
import { RedMonthProvider } from "@/context/RedMonthContext";
import type { Module, Fragebogen, Question } from "@/types/fragebogen";
import { usePathname, useRouter } from "next/navigation";
import {
  createFragebogen,
  createModule,
  deleteFragebogenBackend,
  deleteModuleBackend,
  duplicateFragebogenBackend,
  duplicateModuleBackend,
  fetchFragebogen,
  fetchMarketChains,
  fetchModules,
  updateFragebogenBackend,
  updateModuleBackend,
  type FragebogenScope,
} from "@/lib/api/backend";
import {
  KuehlerCtx, MhdCtx, FlexCtx, BillaCtx,
  type KuehlerCtxValue, type MhdCtxValue, type FlexCtxValue, type BillaCtxValue,
} from "@/app/admin/adminContexts";
import { RedMonthHeaderControl } from "@/components/admin/RedMonthHeaderControl";
import { AnswerChangeRequestFlap } from "@/components/admin/AnswerChangeRequestFlap";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { AdminAccessProvider, useAdminAccess } from "@/context/AdminAccessContext";
import { getAdminPageKeyForPath, type AdminPageKey } from "@/components/ui/adminNavigation";

// ── Purple accent colours (used by MHD) ───────────────────────

function collectUniqueQuestionsFromModules(inputModules: Module[]): Question[] {
  const byId = new Map<string, Question>();
  for (const moduleRow of inputModules) {
    for (const question of moduleRow.questions ?? []) {
      if (!byId.has(question.id)) {
        byId.set(question.id, question);
      }
    }
  }
  return Array.from(byId.values());
}

function AdminAccessGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const access = useAdminAccess();

  useEffect(() => {
    if (!access.isKunde) return;
    if (!access.firstReadableHref) return;
    if (pathname === "/admin") {
      router.replace(access.firstReadableHref);
      return;
    }
    if (access.currentPageKey && !access.canRead(access.currentPageKey)) {
      router.replace(access.firstReadableHref);
    }
  }, [access, pathname, router]);

  if (access.isKunde && !access.firstReadableHref) {
    return (
      <div style={{ display: "flex", minHeight: "100vh", backgroundColor: "#f5f5f7" }}>
        <AdminSidenav />
        <main style={{ flex: 1, display: "grid", placeItems: "center", padding: 28 }}>
          <div
            style={{
              width: "min(420px, 100%)",
              borderRadius: 18,
              border: "1px solid rgba(15,23,42,0.08)",
              background: "#ffffff",
              padding: 24,
              textAlign: "center",
              boxShadow: "0 16px 36px rgba(15,23,42,0.08), inset 0 1px 0 rgba(255,255,255,0.9)",
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(15,23,42,0.42)" }}>
              Kundenzugang
            </div>
            <h1 style={{ margin: "8px 0 6px", fontSize: 18, fontWeight: 800, color: "#0f172a" }}>
              Kein Zugriff freigeschaltet
            </h1>
            <p style={{ margin: 0, fontSize: 12, lineHeight: 1.55, color: "rgba(15,23,42,0.58)" }}>
              Für diesen Kundenaccount wurde noch keine Admin-Seite freigegeben.
            </p>
          </div>
        </main>
      </div>
    );
  }

  return <>{children}</>;
}

function AdminLayoutInner({ children }: { children: React.ReactNode }) {
  const { addModule, updateModule, deleteModule, setEditHandler: setModuleEditHandler, modules } = useModules();
  const { addFragebogen, updateFragebogen, deleteFragebogen, setEditHandler: setFbEditHandler, fragebogenList } = useFragebogen();
  const pathname = usePathname();
  const { session, status } = useAuthGuard(["admin", "kunde"]);
  const authChecked = status === "authorized";
  const isKuehler = pathname.startsWith("/admin/kuehlerinventur");
  const isMhd = pathname.startsWith("/admin/mhd");
  const isFlex = pathname.startsWith("/admin/flexbesuche");
  const isBilla = pathname.startsWith("/admin/billa");
  const isFbManagement = pathname.startsWith("/admin/fbmanagement");
  const isFotoarchiv = pathname.startsWith("/admin/fotoarchiv");
  const isFbNeu = pathname === "/admin/fbmanagement/neu";
  const isFbExtend = pathname.startsWith("/admin/fbmanagement/erweitern/");
  const isPraemien = pathname.startsWith("/admin/praemien");
  const isMaerkte = pathname.startsWith("/admin/maerkte");
  const isLager = pathname.startsWith("/admin/lager");
  const isGebietsmanager = pathname.startsWith("/admin/gebietsmanager");
  const isShelfMerchandiser = pathname.startsWith("/admin/shelfmerchandiser");
  const isZeiterfassung  = pathname.startsWith("/admin/zeiterfassung");
  const isIppBerechnung  = pathname.startsWith("/admin/ipp-berechnung");
  const isGmDashboard    = pathname.startsWith("/admin/gm-dashboard");
  const isDatenschutzAnfragen = pathname.startsWith("/admin/datenschutzanfragen");

  const [importNotice, setImportNotice] = useState<string | null>(null);
  const [availableMarketChains, setAvailableMarketChains] = useState<string[]>([]);
  const importTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentPageKey = getAdminPageKeyForPath(pathname);
  const isKunde = session?.user.role === "kunde";
  const sessionPermissions = useMemo(() => session?.user.permissions ?? {}, [session?.user.permissions]);
  const canAccessCurrentPage = (action: "read" | "write" | "update") => {
    if (!isKunde) return true;
    if (!currentPageKey) return action === "read";
    return (sessionPermissions[currentPageKey as AdminPageKey] ?? []).includes(action);
  };
  const canWriteCurrentPage = canAccessCurrentPage("write");
  const canUpdateCurrentPage = canAccessCurrentPage("update");
  const shouldPreloadFragebogenCatalog =
    !isKunde ||
    (["fragebogen", "flexbesuche", "billa", "kuehlerinventur", "mhd", "fbmanagement"] as AdminPageKey[]).some((pageKey) =>
      (sessionPermissions[pageKey] ?? []).includes("read"),
    );

  useEffect(() => {
    const handler = (e: Event) => {
      const count = (e as CustomEvent).detail?.count as number;
      if (importTimerRef.current) clearTimeout(importTimerRef.current);
      setImportNotice(`${count} Märkte importiert`);
      importTimerRef.current = setTimeout(() => setImportNotice(null), 5000);
    };
    window.addEventListener("maerkte:imported", handler);
    return () => { window.removeEventListener("maerkte:imported", handler); if (importTimerRef.current) clearTimeout(importTimerRef.current); };
  }, []);

  // ── Fragebogen-side state ──────────────────────────────────
  const [moduleEditorOpen, setModuleEditorOpen] = useState(false);
  const [editingModule, setEditingModule] = useState<Module | null>(null);
  const [fbEditorOpen, setFbEditorOpen] = useState(false);
  const [editingFb, setEditingFb] = useState<Fragebogen | null>(null);
  const fragebogenLoadedRef = useRef(false);

  const openEditModule = (m: Module) => { setEditingModule(m); setModuleEditorOpen(true); };
  const openEditFb = (f: Fragebogen) => { setEditingFb(f); setFbEditorOpen(true); };

  useEffect(() => { setModuleEditHandler(openEditModule); }, [setModuleEditHandler]);
  useEffect(() => { setFbEditHandler(openEditFb); }, [setFbEditHandler]);
  useEffect(() => {
    if (!session?.user.id) return;
    fragebogenLoadedRef.current = false;
  }, [session?.user.id]);

  const handleModuleSave = async (m: Module) => {
    const persisted = editingModule
      ? await updateModuleBackend("main", { ...m, sectionKeywords: ["standard"] })
      : await createModule("main", { ...m, sectionKeywords: ["standard"] });
    editingModule
      ? await updateModule(persisted, { persist: false })
      : await addModule(persisted, { persist: false });
    setModuleEditorOpen(false);
    setEditingModule(null);
  };
  const handleFbSave = async (f: Fragebogen) => {
    const persisted = editingFb
      ? await updateFragebogenBackend("main", { ...f, sectionKeywords: ["standard"] })
      : await createFragebogen("main", { ...f, sectionKeywords: ["standard"] });
    editingFb ? updateFragebogen(persisted) : addFragebogen(persisted);
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

  const handleKuehlerModuleSave = async (m: Module) => {
    try {
      const persisted = kuehlerEditingModule ? await updateModuleBackend("kuehler", m) : await createModule("kuehler", m);
      setKuehlerModules((prev) => {
        const exists = prev.find((x) => x.id === persisted.id);
        return exists ? prev.map((x) => (x.id === persisted.id ? persisted : x)) : [persisted, ...prev];
      });
      setKuehlerModuleEditorOpen(false);
      setKuehlerEditingModule(null);
    } catch {
      // Keep editor open on API failure.
    }
  };

  const handleKuehlerFbSave = async (f: Fragebogen) => {
    const persisted = kuehlerEditingFb ? await updateFragebogenBackend("kuehler", f) : await createFragebogen("kuehler", f);
    setKuehlerFragebogenList((prev) => {
      const exists = prev.find((x) => x.id === persisted.id);
      return exists ? prev.map((x) => (x.id === persisted.id ? persisted : x)) : [persisted, ...prev];
    });
    setKuehlerFbEditorOpen(false);
    setKuehlerEditingFb(null);
  };

  const deleteKuehlerModuleKeepQuestions = async (id: string) => {
    try {
      await deleteModuleBackend("kuehler", id);
    } catch {
      return;
    }
    setKuehlerModules((prev) => prev.filter((m) => m.id !== id));
  };

  const kuehlerCtxValue: KuehlerCtxValue = {
    modules: kuehlerModules,
    onEdit: (m) => { setKuehlerEditingModule(m); setKuehlerModuleEditorOpen(true); },
    onUpdate: (m) => setKuehlerModules((prev) => prev.map((x) => (x.id === m.id ? m : x))),
    onDelete: deleteKuehlerModuleKeepQuestions,
    onDuplicate: async (m) => {
      const duplicated = await duplicateModuleBackend("kuehler", m.id, "kuehler");
      setKuehlerModules((prev) => [duplicated, ...prev]);
    },
    fragebogenList: kuehlerFragebogenList,
    onEditFb: (f) => { setKuehlerEditingFb(f); setKuehlerFbEditorOpen(true); },
    onDeleteFb: async (id) => {
      await deleteFragebogenBackend("kuehler", id);
      setKuehlerFragebogenList((prev) => prev.filter((x) => x.id !== id));
    },
    onDuplicateFb: async (f) => {
      const duplicated = await duplicateFragebogenBackend("kuehler", f.id, "kuehler");
      setKuehlerFragebogenList((prev) => [duplicated, ...prev]);
    },
  };

  // ── MHD-side state (fully isolated) ───────────────────────────
  const [mhdModules, setMhdModules] = useState<Module[]>([]);
  const [mhdModuleEditorOpen, setMhdModuleEditorOpen] = useState(false);
  const [mhdEditingModule, setMhdEditingModule] = useState<Module | null>(null);

  const [mhdFragebogenList, setMhdFragebogenList] = useState<Fragebogen[]>([]);
  const [mhdFbEditorOpen, setMhdFbEditorOpen] = useState(false);
  const [mhdEditingFb, setMhdEditingFb] = useState<Fragebogen | null>(null);

  const handleMhdModuleSave = async (m: Module) => {
    try {
      const persisted = mhdEditingModule ? await updateModuleBackend("mhd", m) : await createModule("mhd", m);
      setMhdModules((prev) => {
        const exists = prev.find((x) => x.id === persisted.id);
        return exists ? prev.map((x) => (x.id === persisted.id ? persisted : x)) : [persisted, ...prev];
      });
      setMhdModuleEditorOpen(false);
      setMhdEditingModule(null);
    } catch {
      // Keep editor open on API failure.
    }
  };

  const handleMhdFbSave = async (f: Fragebogen) => {
    const persisted = mhdEditingFb ? await updateFragebogenBackend("mhd", f) : await createFragebogen("mhd", f);
    setMhdFragebogenList((prev) => {
      const exists = prev.find((x) => x.id === persisted.id);
      return exists ? prev.map((x) => (x.id === persisted.id ? persisted : x)) : [persisted, ...prev];
    });
    setMhdFbEditorOpen(false);
    setMhdEditingFb(null);
  };

  const deleteMhdModuleKeepQuestions = async (id: string) => {
    try {
      await deleteModuleBackend("mhd", id);
    } catch {
      return;
    }
    setMhdModules((prev) => prev.filter((m) => m.id !== id));
  };

  const mhdCtxValue: MhdCtxValue = {
    modules: mhdModules,
    onEdit: (m) => { setMhdEditingModule(m); setMhdModuleEditorOpen(true); },
    onUpdate: (m) => setMhdModules((prev) => prev.map((x) => (x.id === m.id ? m : x))),
    onDelete: deleteMhdModuleKeepQuestions,
    onDuplicate: async (m) => {
      const duplicated = await duplicateModuleBackend("mhd", m.id, "mhd");
      setMhdModules((prev) => [duplicated, ...prev]);
    },
    fragebogenList: mhdFragebogenList,
    onEditFb: (f) => { setMhdEditingFb(f); setMhdFbEditorOpen(true); },
    onDeleteFb: async (id) => {
      await deleteFragebogenBackend("mhd", id);
      setMhdFragebogenList((prev) => prev.filter((x) => x.id !== id));
    },
    onDuplicateFb: async (f) => {
      const duplicated = await duplicateFragebogenBackend("mhd", f.id, "mhd");
      setMhdFragebogenList((prev) => [duplicated, ...prev]);
    },
  };

  // ── Flexbesuche-side state (modules isolated; fragebogen isolated; questions shared via flat view) ──
  const [flexModules, setFlexModules] = useState<Module[]>([]);
  const [flexModuleEditorOpen, setFlexModuleEditorOpen] = useState(false);
  const [flexEditingModule, setFlexEditingModule] = useState<Module | null>(null);

  const [flexFragebogenList, setFlexFragebogenList] = useState<Fragebogen[]>([]);
  const [flexFbEditorOpen, setFlexFbEditorOpen] = useState(false);
  const [flexEditingFb, setFlexEditingFb] = useState<Fragebogen | null>(null);

  const handleFlexModuleSave = async (m: Module) => {
    try {
      const persisted = flexEditingModule
        ? await updateModuleBackend("main", { ...m, sectionKeywords: ["flex"] })
        : await createModule("main", { ...m, sectionKeywords: ["flex"] });
      setFlexModules((prev) => {
        const exists = prev.find((x) => x.id === persisted.id);
        return exists ? prev.map((x) => (x.id === persisted.id ? persisted : x)) : [persisted, ...prev];
      });
      setFlexModuleEditorOpen(false);
      setFlexEditingModule(null);
    } catch {
      // Keep editor open on API failure.
    }
  };

  const handleFlexFbSave = async (f: Fragebogen) => {
    const persisted = flexEditingFb
      ? await updateFragebogenBackend("main", { ...f, sectionKeywords: ["flex"] })
      : await createFragebogen("main", { ...f, sectionKeywords: ["flex"] });
    setFlexFragebogenList((prev) => {
      const exists = prev.find((x) => x.id === persisted.id);
      return exists ? prev.map((x) => (x.id === persisted.id ? persisted : x)) : [persisted, ...prev];
    });
    setFlexFbEditorOpen(false);
    setFlexEditingFb(null);
  };

  const deleteFlexModuleKeepQuestions = async (id: string) => {
    try {
      await deleteModuleBackend("main", id);
    } catch {
      return;
    }
    setFlexModules((prev) => prev.filter((m) => m.id !== id));
  };

  const mergeModuleList = (current: Module[], incoming: Module[]): Module[] => {
    if (incoming.length === 0) return current;
    const byId = new Map(current.map((entry) => [entry.id, entry]));
    for (const entry of incoming) {
      byId.set(entry.id, entry);
    }
    const incomingIds = new Set(incoming.map((entry) => entry.id));
    const next = [...incoming, ...current.filter((entry) => !incomingIds.has(entry.id))];
    return next.map((entry) => byId.get(entry.id) ?? entry);
  };

  const fetchMainModulesByIds = async (moduleIds: string[]): Promise<Module[]> => {
    const uniqueIds = Array.from(new Set(moduleIds));
    if (uniqueIds.length === 0) return [];
    const allMainModules = await fetchModules("main");
    const moduleById = new Map(allMainModules.map((entry) => [entry.id, entry]));
    return uniqueIds.map((id) => moduleById.get(id)).filter((entry): entry is Module => Boolean(entry));
  };

  const syncStandardModulesByIds = async (moduleIds: string[]): Promise<void> => {
    const targetModules = await fetchMainModulesByIds(moduleIds);
    if (targetModules.length === 0) return;
    const existingModuleById = new Map(modules.map((entry) => [entry.id, entry]));
    for (const entry of targetModules) {
      if (existingModuleById.has(entry.id)) {
        await updateModule(entry, { persist: false });
      } else {
        await addModule(entry, { persist: false });
      }
    }
  };

  const flexCtxValue: FlexCtxValue = {
    modules: flexModules,
    onEdit: (m) => { setFlexEditingModule(m); setFlexModuleEditorOpen(true); },
    onUpdate: (m) => setFlexModules((prev) => prev.map((x) => (x.id === m.id ? m : x))),
    onDelete: deleteFlexModuleKeepQuestions,
    onDuplicate: async (m) => {
      const duplicated = await duplicateModuleBackend("main", m.id, "main", ["flex"]);
      setFlexModules((prev) => [duplicated, ...prev]);
    },
    duplicateModuleToStd: async (m) => {
      const duplicated = await duplicateModuleBackend("main", m.id, "main", ["standard"]);
      await syncStandardModulesByIds([duplicated.id]);
    },
    duplicateModuleToFlex: async (m) => {
      const duplicated = await duplicateModuleBackend("main", m.id, "main", ["flex"]);
      setFlexModules((prev) => [duplicated, ...prev]);
    },
    duplicateModuleToBilla: async (m) => {
      const duplicated = await duplicateModuleBackend("main", m.id, "main", ["billa"]);
      setBillaModules((prev) => [duplicated, ...prev]);
    },
    fragebogenList: flexFragebogenList,
    onEditFb: (f) => { setFlexEditingFb(f); setFlexFbEditorOpen(true); },
    onDeleteFb: async (id) => {
      await deleteFragebogenBackend("main", id);
      setFlexFragebogenList((prev) => prev.filter((x) => x.id !== id));
    },
    onDuplicateFb: async (f) => {
      const duplicated = await duplicateFragebogenBackend("main", f.id, "main", {
        sectionKeywords: ["flex"],
      });
      setFlexFragebogenList((prev) => [duplicated, ...prev]);
    },
    duplicateFbToFlex: async (f) => {
      const duplicated = await duplicateFragebogenBackend("main", f.id, "main", {
        sectionKeywords: ["flex"],
        duplicateModulesToTargetSection: true,
      });
      const duplicatedModules = await fetchMainModulesByIds(duplicated.moduleIds);
      setFlexModules((prev) => mergeModuleList(prev, duplicatedModules));
      setFlexFragebogenList((prev) => [duplicated, ...prev]);
    },
    duplicateFbToStd: async (f) => {
      const duplicated = await duplicateFragebogenBackend("main", f.id, "main", {
        sectionKeywords: ["standard"],
        duplicateModulesToTargetSection: true,
      });
      await syncStandardModulesByIds(duplicated.moduleIds);
      addFragebogen(duplicated);
    },
    duplicateFbToBilla: async (f) => {
      const duplicated = await duplicateFragebogenBackend("main", f.id, "main", {
        sectionKeywords: ["billa"],
        duplicateModulesToTargetSection: true,
      });
      const duplicatedModules = await fetchMainModulesByIds(duplicated.moduleIds);
      setBillaModules((prev) => mergeModuleList(prev, duplicatedModules));
      setBillaFragebogenList((prev) => [duplicated, ...prev]);
    },
  };

  // ── Billa-side state (modules isolated; fragebogen isolated; questions shared) ──
  const [billaModules, setBillaModules] = useState<Module[]>([]);
  const [billaModuleEditorOpen, setBillaModuleEditorOpen] = useState(false);
  const [billaEditingModule, setBillaEditingModule] = useState<Module | null>(null);

  const [billaFragebogenList, setBillaFragebogenList] = useState<Fragebogen[]>([]);
  const [billaFbEditorOpen, setBillaFbEditorOpen] = useState(false);
  const [billaEditingFb, setBillaEditingFb] = useState<Fragebogen | null>(null);

  const handleBillaModuleSave = async (m: Module) => {
    try {
      const persisted = billaEditingModule
        ? await updateModuleBackend("main", { ...m, sectionKeywords: ["billa"] })
        : await createModule("main", { ...m, sectionKeywords: ["billa"] });
      setBillaModules((prev) => {
        const exists = prev.find((x) => x.id === persisted.id);
        return exists ? prev.map((x) => (x.id === persisted.id ? persisted : x)) : [persisted, ...prev];
      });
      setBillaModuleEditorOpen(false);
      setBillaEditingModule(null);
    } catch {
      // Keep editor open on API failure.
    }
  };

  const handleBillaFbSave = async (f: Fragebogen) => {
    const persisted = billaEditingFb
      ? await updateFragebogenBackend("main", { ...f, sectionKeywords: ["billa"] })
      : await createFragebogen("main", { ...f, sectionKeywords: ["billa"] });
    setBillaFragebogenList((prev) => {
      const exists = prev.find((x) => x.id === persisted.id);
      return exists ? prev.map((x) => (x.id === persisted.id ? persisted : x)) : [persisted, ...prev];
    });
    setBillaFbEditorOpen(false);
    setBillaEditingFb(null);
  };

  const deleteBillaModuleKeepQuestions = async (id: string) => {
    try {
      await deleteModuleBackend("main", id);
    } catch {
      return;
    }
    setBillaModules((prev) => prev.filter((m) => m.id !== id));
  };

  const billaCtxValue: BillaCtxValue = {
    modules: billaModules,
    onEdit: (m) => { setBillaEditingModule(m); setBillaModuleEditorOpen(true); },
    onUpdate: (m) => setBillaModules((prev) => prev.map((x) => (x.id === m.id ? m : x))),
    onDelete: deleteBillaModuleKeepQuestions,
    onDuplicate: async (m) => {
      const duplicated = await duplicateModuleBackend("main", m.id, "main", ["billa"]);
      setBillaModules((prev) => [duplicated, ...prev]);
    },
    duplicateModuleToStd: async (m) => {
      const duplicated = await duplicateModuleBackend("main", m.id, "main", ["standard"]);
      await syncStandardModulesByIds([duplicated.id]);
    },
    duplicateModuleToFlex: async (m) => {
      const duplicated = await duplicateModuleBackend("main", m.id, "main", ["flex"]);
      setFlexModules((prev) => [duplicated, ...prev]);
    },
    duplicateModuleToBilla: async (m) => {
      const duplicated = await duplicateModuleBackend("main", m.id, "main", ["billa"]);
      setBillaModules((prev) => [duplicated, ...prev]);
    },
    fragebogenList: billaFragebogenList,
    onEditFb: (f) => { setBillaEditingFb(f); setBillaFbEditorOpen(true); },
    onDeleteFb: async (id) => {
      await deleteFragebogenBackend("main", id);
      setBillaFragebogenList((prev) => prev.filter((x) => x.id !== id));
    },
    onDuplicateFb: async (f) => {
      const duplicated = await duplicateFragebogenBackend("main", f.id, "main", {
        sectionKeywords: ["billa"],
      });
      setBillaFragebogenList((prev) => [duplicated, ...prev]);
    },
    duplicateFbToStd: async (f) => {
      const duplicated = await duplicateFragebogenBackend("main", f.id, "main", {
        sectionKeywords: ["standard"],
        duplicateModulesToTargetSection: true,
      });
      await syncStandardModulesByIds(duplicated.moduleIds);
      addFragebogen(duplicated);
    },
    duplicateFbToFlex: async (f) => {
      const duplicated = await duplicateFragebogenBackend("main", f.id, "main", {
        sectionKeywords: ["flex"],
        duplicateModulesToTargetSection: true,
      });
      const duplicatedModules = await fetchMainModulesByIds(duplicated.moduleIds);
      setFlexModules((prev) => mergeModuleList(prev, duplicatedModules));
      setFlexFragebogenList((prev) => [duplicated, ...prev]);
    },
    duplicateFbToBilla: async (f) => {
      const duplicated = await duplicateFragebogenBackend("main", f.id, "main", {
        sectionKeywords: ["billa"],
        duplicateModulesToTargetSection: true,
      });
      const duplicatedModules = await fetchMainModulesByIds(duplicated.moduleIds);
      setBillaModules((prev) => mergeModuleList(prev, duplicatedModules));
      setBillaFragebogenList((prev) => [duplicated, ...prev]);
    },
  };

  useEffect(() => {
    if (!authChecked || !shouldPreloadFragebogenCatalog) return;
    if (fragebogenLoadedRef.current) return;
    fragebogenLoadedRef.current = true;
    let cancelled = false;
    const loadScope = async (scope: FragebogenScope) => {
      const [mods, fbs] = await Promise.all([fetchModules(scope), fetchFragebogen(scope)]);
      if (cancelled) return { mods: [], fbs: [] as Fragebogen[] };
      return { mods, fbs };
    };
    (async () => {
      try {
        const [mainData, kuehlerData, mhdData, marketChains] = await Promise.all([
          loadScope("main"),
          loadScope("kuehler"),
          loadScope("mhd"),
          fetchMarketChains(),
        ]);
        if (cancelled) return;

        if (modules.length === 0) {
          mainData.mods
            .filter((m) => !(m as Module & { sectionKeywords?: string[] }).sectionKeywords || (m as Module & { sectionKeywords?: string[] }).sectionKeywords?.includes("standard"))
            .forEach((m) => addModule(m));
        }
        if (fragebogenList.length === 0) {
          mainData.fbs
            .filter((f) => !(f as Fragebogen & { sectionKeywords?: string[] }).sectionKeywords || (f as Fragebogen & { sectionKeywords?: string[] }).sectionKeywords?.includes("standard"))
            .forEach((f) => addFragebogen(f));
        }

        setKuehlerModules(kuehlerData.mods);
        setKuehlerFragebogenList(kuehlerData.fbs);
        setMhdModules(mhdData.mods);
        setMhdFragebogenList(mhdData.fbs);

        // Flex/Billa are represented in main table with section keywords.
        setFlexModules(mainData.mods.filter((m) => (m as Module & { sectionKeywords?: string[] }).sectionKeywords?.includes("flex")));
        setFlexFragebogenList(mainData.fbs.filter((f) => (f as Fragebogen & { sectionKeywords?: string[] }).sectionKeywords?.includes("flex")));
        setBillaModules(mainData.mods.filter((m) => (m as Module & { sectionKeywords?: string[] }).sectionKeywords?.includes("billa")));
        setBillaFragebogenList(mainData.fbs.filter((f) => (f as Fragebogen & { sectionKeywords?: string[] }).sectionKeywords?.includes("billa")));
        setAvailableMarketChains(marketChains);
      } catch {
        // keep local fallback behavior
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [addFragebogen, addModule, authChecked, fragebogenList.length, modules.length, session?.user.id, shouldPreloadFragebogenCatalog]);

  if (!authChecked) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#f5f5f7" }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: "rgba(0,0,0,0.45)" }}>Authentifizierung wird geprüft...</p>
      </main>
    );
  }

  const sharedPoolExistingQuestions = collectUniqueQuestionsFromModules([...modules, ...flexModules, ...billaModules]);
  const standardExistingQuestions = sharedPoolExistingQuestions;
  const kuehlerExistingQuestions = collectUniqueQuestionsFromModules(kuehlerModules);
  const mhdExistingQuestions = collectUniqueQuestionsFromModules(mhdModules);
  const flexExistingQuestions = sharedPoolExistingQuestions;
  const billaExistingQuestions = sharedPoolExistingQuestions;

  const pageTitle = isMhd ? "MHD" : isKuehler ? "Kühlerinventur" : isFlex ? "Flexbesuche" : isBilla ? "Billa" : isFbNeu ? "Neue Kampagne" : isFbManagement ? "FB Management" : isFotoarchiv ? "Fotoarchiv" : isPraemien ? "Prämien" : isMaerkte ? "Märkte" : isLager ? "Lager" : isGebietsmanager ? "Gebietsmanager" : isShelfMerchandiser ? "Shelf Merchandiser" : isZeiterfassung ? "Zeiterfassung" : isIppBerechnung ? "IPP Berechnung" : isGmDashboard ? "GM Dashboard" : isDatenschutzAnfragen ? "Datenschutzanfragen" : "Standardbesuch";
  const exportEventName =
    isMhd ? "admin:mhd:export"
    : isKuehler ? "admin:kuehlerinventur:export"
    : isFlex ? "admin:flexbesuche:export"
    : isBilla ? "admin:billa:export"
    : isFbManagement ? "admin:fbmanagement:export"
    : isFotoarchiv ? "admin:fotoarchiv:export"
    : isPraemien ? "admin:praemien:export"
    : isMaerkte ? "admin:maerkte:export"
    : isLager ? "admin:lager:export"
    : isGebietsmanager ? "admin:gebietsmanager:export"
    : isShelfMerchandiser ? "admin:shelfmerchandiser:export"
    : isIppBerechnung ? "admin:ipp:export"
    : isGmDashboard ? "admin:gm-dashboard:export"
    : pathname === "/admin/fragebogen" ? "admin:fragebogen:export"
    : null;
  const showHeaderExcelExport = Boolean(exportEventName) && !isFbNeu && !isFbExtend;
  const headerExportLabel = isFotoarchiv ? "Foto Export" : "Excel Export";
  const HeaderExportIcon = isFotoarchiv ? Download : FileSpreadsheet;
  const headerSecondaryButtonStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 5,
    padding: "7px 14px",
    fontSize: 11,
    fontWeight: 650,
    color: "rgba(0,0,0,0.62)",
    background: "linear-gradient(to bottom, #ffffff, #f5f5f5)",
    border: "none",
    borderRadius: 7,
    cursor: "pointer",
    transition: "all 0.15s ease",
    letterSpacing: "0.01em",
    boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.9), inset 0 -1px 0 rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.07)",
  };

  return (
    <AdminAccessProvider session={session} pathname={pathname}>
    <AdminAccessGate>
    <RedMonthProvider>
    <BillaCtx.Provider value={billaCtxValue}>
    <FlexCtx.Provider value={flexCtxValue}>
    <MhdCtx.Provider value={mhdCtxValue}>
    <KuehlerCtx.Provider value={kuehlerCtxValue}>
      <div style={{ display: "flex", minHeight: "100vh", backgroundColor: "#f5f5f7" }}>
        <AdminSidenav />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          <header style={{ height: 80, backgroundColor: "#ffffff", borderBottom: "1px solid rgba(0,0,0,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 28px", flexShrink: 0, position: "relative" }}>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1a1a1a", letterSpacing: "-0.02em", margin: 0 }}>{pageTitle}</h1>
              {isDatenschutzAnfragen ? (
                <p style={{ margin: "6px 0 0", fontSize: 11, fontWeight: 600, color: "rgba(0,0,0,0.42)", letterSpacing: "0.01em" }}>
                  DSGVO-Prozess, Fristen und Datenpakete
                </p>
              ) : !isGmDashboard ? <RedMonthHeaderControl /> : null}
            </div>

            {/* Centered import notice */}
            {importNotice && (
              <div style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", display: "flex", alignItems: "center", gap: 7, padding: "6px 14px", borderRadius: 20, background: "rgba(22,163,74,0.07)", border: "1px solid rgba(22,163,74,0.18)", animation: "noticeIn 0.2s ease both" }}>
                <style>{`@keyframes noticeIn{from{opacity:0;transform:translateX(-50%) translateY(-4px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}`}</style>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#16a34a", flexShrink: 0 }} />
                <span style={{ fontSize: 11, fontWeight: 600, color: "#15803d", whiteSpace: "nowrap" }}>{importNotice}</span>
              </div>
            )}

            {/* Action buttons */}
            <div style={{ display: "flex", gap: 10 }}>
              {showHeaderExcelExport && exportEventName ? (
                <button
                  type="button"
                  onClick={() => window.dispatchEvent(new CustomEvent(exportEventName))}
                  style={headerSecondaryButtonStyle}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.82"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
                >
                  <HeaderExportIcon size={12} strokeWidth={2} />
                  {headerExportLabel}
                </button>
              ) : null}
              {isMhd && canWriteCurrentPage ? (
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
              ) : isKuehler && canWriteCurrentPage ? (
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
              ) : isFlex && canWriteCurrentPage ? (
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
              ) : isBilla && canWriteCurrentPage ? (
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
              ) : isFbNeu || isFbExtend ? (
                <Link href="/admin/fbmanagement" style={{ textDecoration: "none" }}>
                  <button
                    style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 16px", fontSize: 11, fontWeight: 600, color: "rgba(0,0,0,0.5)", background: "linear-gradient(to bottom, #ffffff, #f5f5f5)", border: "none", borderRadius: 7, cursor: "pointer", transition: "all 0.15s ease", letterSpacing: "0.01em", boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.9), inset 0 -1px 0 rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.07)" }}
                  >
                    ← Zurück
                  </button>
                </Link>
              ) : isFbManagement && canWriteCurrentPage ? (
                <Link href="/admin/fbmanagement/neu" style={{ textDecoration: "none" }}>
                  <button
                    style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 16px", fontSize: 11, fontWeight: 600, color: "#ffffff", background: "linear-gradient(to bottom, #DC2626, #b91c1c)", border: "none", borderRadius: 7, cursor: "pointer", transition: "all 0.15s ease", letterSpacing: "0.01em", boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.33), inset 0 -1px 0 rgba(255,255,255,0.15), 0 0 0 1px #a91b1b, 0 1px 6px rgba(180,20,20,0.14)" }}
                  >
                    <Plus size={12} strokeWidth={2} />
                    Neue Kampagne
                  </button>
                </Link>
              ) : isFotoarchiv ? null : isPraemien ? null : isGmDashboard ? null : isDatenschutzAnfragen ? null : isZeiterfassung ? (
                <button
                  style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 16px", fontSize: 11, fontWeight: 600, color: "#ffffff", background: "linear-gradient(to bottom, #DC2626, #b91c1c)", border: "none", borderRadius: 7, cursor: "pointer", transition: "all 0.15s ease", letterSpacing: "0.01em", boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.33), inset 0 -1px 0 rgba(255,255,255,0.15), 0 0 0 1px #a91b1b, 0 1px 6px rgba(180,20,20,0.14)" }}
                  onClick={() => window.dispatchEvent(new CustomEvent("zeiterfassung:openExport"))}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.85"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
                >
                  <Download size={12} strokeWidth={2} />
                  Exportieren
                </button>
              ) : isIppBerechnung ? null : isLager ? null : isMaerkte ? (
                <>
                  {canUpdateCurrentPage ? <button
                    onClick={() => window.dispatchEvent(new CustomEvent("maerkte:normalizeRegions"))}
                    style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 14px", fontSize: 11, fontWeight: 600, color: "rgba(0,0,0,0.62)", background: "linear-gradient(to bottom, #ffffff, #f5f5f5)", border: "none", borderRadius: 7, cursor: "pointer", transition: "all 0.15s ease", letterSpacing: "0.01em", boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.9), inset 0 -1px 0 rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.07)" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.82"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
                  >
                    Regionen normalisieren
                  </button> : null}
                  {canWriteCurrentPage ? <button
                    onClick={() => window.dispatchEvent(new CustomEvent("maerkte:openImport"))}
                    style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 16px", fontSize: 11, fontWeight: 600, color: "#ffffff", background: "linear-gradient(to bottom, #DC2626, #b91c1c)", border: "none", borderRadius: 7, cursor: "pointer", transition: "all 0.15s ease", letterSpacing: "0.01em", boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.33), inset 0 -1px 0 rgba(255,255,255,0.15), 0 0 0 1px #a91b1b, 0 1px 6px rgba(180,20,20,0.14)" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.9"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
                  >
                    <Plus size={12} strokeWidth={2} />
                    Importieren
                  </button> : null}
                </>
              ) : isGebietsmanager && canWriteCurrentPage ? (
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent("gebietsmanager:openCreate"))}
                  style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 16px", fontSize: 11, fontWeight: 600, color: "#ffffff", background: "linear-gradient(to bottom, #DC2626, #b91c1c)", border: "none", borderRadius: 7, cursor: "pointer", transition: "all 0.15s ease", letterSpacing: "0.01em", boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.33), inset 0 -1px 0 rgba(255,255,255,0.15), 0 0 0 1px #a91b1b, 0 1px 6px rgba(180,20,20,0.14)" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.9"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
                >
                  <Plus size={12} strokeWidth={2} />
                  GM erstellen
                </button>
              ) : isShelfMerchandiser && canWriteCurrentPage ? (
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent("shelfmerchandiser:openCreate"))}
                  style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 16px", fontSize: 11, fontWeight: 600, color: "#ffffff", background: "linear-gradient(to bottom, #DC2626, #b91c1c)", border: "none", borderRadius: 7, cursor: "pointer", transition: "all 0.15s ease", letterSpacing: "0.01em", boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.33), inset 0 -1px 0 rgba(255,255,255,0.15), 0 0 0 1px #a91b1b, 0 1px 6px rgba(180,20,20,0.14)" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.9"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
                >
                  <Plus size={12} strokeWidth={2} />
                  SM erstellen
                </button>
              ) : canWriteCurrentPage ? (
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
              ) : null}
            </div>
          </header>

          <main style={{ flex: 1, padding: 28 }}>
            {children}
          </main>
        </div>
        {session?.user.role === "admin" ? <AnswerChangeRequestFlap /> : null}

        {/* Fragebogen modals */}
        {moduleEditorOpen && (
          <ModuleEditor
            existingModule={editingModule ?? undefined}
            availableChains={availableMarketChains}
            existingQuestions={standardExistingQuestions}
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
            existingQuestions={kuehlerExistingQuestions}
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
            existingQuestions={mhdExistingQuestions}
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
            existingQuestions={flexExistingQuestions}
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
            existingQuestions={billaExistingQuestions}
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
    </RedMonthProvider>
    </AdminAccessGate>
    </AdminAccessProvider>
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
