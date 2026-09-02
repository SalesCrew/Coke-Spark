"use client";

import { createContext, useContext, useState, useCallback } from "react";
import type { Module } from "@/types/fragebogen";
import { createModule, deleteModuleBackend, updateModuleBackend } from "@/lib/api/backend";

interface ModuleContextValue {
  modules: Module[];
  addModule: (m: Module, options?: { persist?: boolean }) => Promise<void>;
  updateModule: (m: Module, options?: { persist?: boolean }) => Promise<void>;
  deleteModule: (id: string) => Promise<void>;
  deleteModuleKeepQuestions: (id: string) => Promise<void>;
  editModule: (m: Module) => void;
  setEditHandler: (handler: (m: Module) => void) => void;
}

const ModuleContext = createContext<ModuleContextValue | null>(null);
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function ModuleProvider({ children }: { children: React.ReactNode }) {
  const [modules, setModules] = useState<Module[]>([]);
  const [editHandler, setEditHandlerState] = useState<((m: Module) => void) | null>(null);

  const addModule = useCallback(async (m: Module, options?: { persist?: boolean }) => {
    const persist = options?.persist ?? true;
    setModules((prev) => [m, ...prev]);
    if (persist && !uuidRegex.test(m.id)) {
      try {
        const persisted = await createModule("main", { ...m, sectionKeywords: ["standard"] });
        setModules((prev) => prev.map((row) => (row.id === m.id ? persisted : row)));
      } catch (error) {
        setModules((prev) => prev.filter((row) => row.id !== m.id));
        throw error;
      }
    }
  }, []);

  const updateModule = useCallback(async (m: Module, options?: { persist?: boolean }) => {
    const persist = options?.persist ?? true;
    let previous: Module | null = null;
    setModules((prev) =>
      prev.map((old) => {
        if (old.id !== m.id) return old;
        previous = old;
        return m;
      }),
    );
    if (!persist || !uuidRegex.test(m.id)) return;
    try {
      const persisted = await updateModuleBackend("main", { ...m, sectionKeywords: ["standard"] });
      setModules((prev) => prev.map((old) => (old.id === persisted.id ? persisted : old)));
    } catch (error) {
      if (previous) {
        setModules((prev) => prev.map((old) => (old.id === m.id ? previous! : old)));
      }
      throw error;
    }
  }, []);

  const deleteModule = useCallback(async (id: string) => {
    let removedModule: Module | null = null;
    setModules((prev) => {
      const found = prev.find((module) => module.id === id);
      removedModule = found ?? null;
      return prev.filter((module) => module.id !== id);
    });
    if (!uuidRegex.test(id)) return;
    try {
      await deleteModuleBackend("main", id);
    } catch (error) {
      if (removedModule) {
        setModules((prev) => [removedModule!, ...prev]);
      }
      throw error;
    }
  }, []);

  const deleteModuleKeepQuestions = useCallback(async (id: string) => deleteModule(id), [deleteModule]);

  const editModule = useCallback((m: Module) => {
    editHandler?.(m);
  }, [editHandler]);

  const setEditHandler = useCallback((handler: (m: Module) => void) => {
    setEditHandlerState(() => handler);
  }, []);

  return (
    <ModuleContext.Provider value={{ modules, addModule, updateModule, deleteModule, deleteModuleKeepQuestions, editModule, setEditHandler }}>
      {children}
    </ModuleContext.Provider>
  );
}

export function useModules() {
  const ctx = useContext(ModuleContext);
  if (!ctx) throw new Error("useModules must be used within ModuleProvider");
  return ctx;
}
