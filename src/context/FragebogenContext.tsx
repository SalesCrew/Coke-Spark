"use client";

import { createContext, useContext, useState, useCallback } from "react";
import type { Fragebogen } from "@/types/fragebogen";

interface FragebogenContextValue {
  fragebogenList: Fragebogen[];
  addFragebogen: (f: Fragebogen) => void;
  updateFragebogen: (f: Fragebogen) => void;
  deleteFragebogen: (id: string) => void;
  editFragebogen: (f: Fragebogen) => void;
  setEditHandler: (handler: (f: Fragebogen) => void) => void;
}

const FragebogenContext = createContext<FragebogenContextValue | null>(null);

export function FragebogenProvider({ children }: { children: React.ReactNode }) {
  const [fragebogenList, setFragebogenList] = useState<Fragebogen[]>([]);
  const [editHandler, setEditHandlerState] = useState<((f: Fragebogen) => void) | null>(null);

  const addFragebogen = useCallback((f: Fragebogen) => {
    setFragebogenList((prev) => [f, ...prev]);
  }, []);

  const updateFragebogen = useCallback((f: Fragebogen) => {
    setFragebogenList((prev) => prev.map((old) => (old.id === f.id ? f : old)));
  }, []);

  const deleteFragebogen = useCallback((id: string) => {
    setFragebogenList((prev) => prev.filter((f) => f.id !== id));
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
