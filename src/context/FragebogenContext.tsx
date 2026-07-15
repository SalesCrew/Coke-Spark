"use client";

import { createContext, useContext, useState, useCallback } from "react";
import type { Fragebogen } from "@/types/fragebogen";
import {
  createFragebogen,
  deleteFragebogenBackend,
  updateFragebogenBackend,
} from "@/lib/api/backend";

interface FragebogenContextValue {
  fragebogenList: Fragebogen[];
  addFragebogen: (f: Fragebogen) => void;
  updateFragebogen: (f: Fragebogen, options?: { persist?: boolean }) => Promise<Fragebogen>;
  deleteFragebogen: (id: string) => void;
  editFragebogen: (f: Fragebogen) => void;
  setEditHandler: (handler: (f: Fragebogen) => void) => void;
}

const FragebogenContext = createContext<FragebogenContextValue | null>(null);
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function FragebogenProvider({ children }: { children: React.ReactNode }) {
  const [fragebogenList, setFragebogenList] = useState<Fragebogen[]>([]);
  const [editHandler, setEditHandlerState] = useState<((f: Fragebogen) => void) | null>(null);

  const addFragebogen = useCallback((f: Fragebogen) => {
    setFragebogenList((prev) => [f, ...prev]);
    if (!uuidRegex.test(f.id)) {
      void createFragebogen("main", f).then((persisted) => {
        setFragebogenList((prev) => prev.map((row) => (row.id === f.id ? persisted : row)));
      });
    }
  }, []);

  const updateFragebogen = useCallback(async (f: Fragebogen, options: { persist?: boolean } = {}) => {
    const shouldPersist = options.persist !== false && uuidRegex.test(f.id);
    const persisted = shouldPersist ? await updateFragebogenBackend("main", f) : f;
    setFragebogenList((prev) => prev.map((old) => (old.id === f.id ? persisted : old)));
    return persisted;
  }, []);

  const deleteFragebogen = useCallback((id: string) => {
    setFragebogenList((prev) => prev.filter((f) => f.id !== id));
    if (uuidRegex.test(id)) {
      void deleteFragebogenBackend("main", id);
    }
  }, []);

  const editFragebogen = useCallback(
    (f: Fragebogen) => {
      editHandler?.(f);
    },
    [editHandler]
  );

  const setEditHandler = useCallback((handler: (f: Fragebogen) => void) => {
    setEditHandlerState(() => handler);
  }, []);

  return (
    <FragebogenContext.Provider
      value={{
        fragebogenList,
        addFragebogen,
        updateFragebogen,
        deleteFragebogen,
        editFragebogen,
        setEditHandler,
      }}
    >
      {children}
    </FragebogenContext.Provider>
  );
}

export function useFragebogen() {
  const ctx = useContext(FragebogenContext);
  if (!ctx) throw new Error("useFragebogen must be used within FragebogenProvider");
  return ctx;
}
