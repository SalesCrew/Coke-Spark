"use client";

import { createContext, useContext, useState, useCallback } from "react";
import type { Module } from "@/types/fragebogen";

interface ModuleContextValue {
  modules: Module[];
  addModule: (m: Module) => void;
  updateModule: (m: Module) => void;
  deleteModule: (id: string) => void;
  deleteModuleKeepQuestions: (id: string) => void;
  editModule: (m: Module) => void;
  setEditHandler: (handler: (m: Module) => void) => void;
}

const ModuleContext = createContext<ModuleContextValue | null>(null);

export function ModuleProvider({ children }: { children: React.ReactNode }) {
  const [modules, setModules] = useState<Module[]>([]);
  const [editHandler, setEditHandlerState] = useState<((m: Module) => void) | null>(null);

  const addModule = useCallback((m: Module) => {
    setModules((prev) => [m, ...prev]);
  }, []);

  const updateModule = useCallback((m: Module) => {
    setModules((prev) => prev.map((old) => (old.id === m.id ? m : old)));
  }, []);

  const deleteModule = useCallback((id: string) => {
    setModules((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const deleteModuleKeepQuestions = useCallback((id: string) => {
    setModules((prev) => {
      const target = prev.find((m) => m.id === id);
      if (!target || target.questions.length === 0) {
        return prev.filter((m) => m.id !== id);
      }
      const UNASSIGNED_ID = "__unassigned__";
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
  }, []);

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
