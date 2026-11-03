"use client";

import { useCallback, useMemo, useState, type SetStateAction } from "react";
import type { Module } from "@/types/fragebogen";

/** Assignment IDs survive a stale or still-loading module catalogue. */
export function useAssignedModules(initialIds: string[], availableModules: Module[]) {
  const [ids, setIds] = useState(() => [...initialIds]);
  const byId = useMemo(() => new Map(availableModules.map(module => [module.id, module])), [availableModules]);
  const resolve = useCallback((moduleIds: string[]) => moduleIds.map(id => byId.get(id) ?? {
    id, name: "Modul nicht geladen", description: "", questions: [], createdAt: "", usedInCount: 0,
  }), [byId]);
  const selectedModules = useMemo(() => resolve(ids), [ids, resolve]);
  const setSelectedModules = useCallback((action: SetStateAction<Module[]>) => {
    setIds(previous => (typeof action === "function" ? action(resolve(previous)) : action).map(module => module.id));
  }, [resolve]);
  return { selectedModules, setSelectedModules, hasMissingModules: ids.some(id => !byId.has(id)) };
}
