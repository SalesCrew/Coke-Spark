"use client";

import { createContext, useContext } from "react";
import type { Module, Fragebogen } from "@/types/fragebogen";
import type { FragebogenScope } from "@/lib/api/backend";

export interface DurcharbeitCopyCtxValue {
  copyFragebogenToDurcharbeit: (
    sourceScope: FragebogenScope,
    fragebogen: Fragebogen,
  ) => Promise<void>;
}

export const DurcharbeitCopyCtx = createContext<DurcharbeitCopyCtxValue>({
  copyFragebogenToDurcharbeit: async () => {},
});

export function useDurcharbeitCopy() {
  return useContext(DurcharbeitCopyCtx);
}

// ── Kühlerinventur context ─────────────────────────────────────
export interface KuehlerCtxValue {
  modules: Module[];
  onEdit: (m: Module) => void | Promise<void>;
  onUpdate: (m: Module) => void | Promise<void>;
  onDelete: (id: string) => void | Promise<void>;
  onDuplicate: (m: Module) => void | Promise<void>;
  fragebogenList: Fragebogen[];
  onEditFb: (f: Fragebogen) => void | Promise<void>;
  onUpdateFb: (f: Fragebogen) => void | Promise<void>;
  onDeleteFb: (id: string) => void | Promise<void>;
  onDuplicateFb: (f: Fragebogen) => void | Promise<void>;
}

export const KuehlerCtx = createContext<KuehlerCtxValue>({
  modules: [],
  onEdit: () => {},
  onUpdate: () => {},
  onDelete: () => {},
  onDuplicate: () => {},
  fragebogenList: [],
  onEditFb: () => {},
  onUpdateFb: () => {},
  onDeleteFb: () => {},
  onDuplicateFb: () => {},
});

export function useKuehlerModules() {
  return useContext(KuehlerCtx);
}

// ── MHD context ────────────────────────────────────────────────
export interface MhdCtxValue {
  modules: Module[];
  onEdit: (m: Module) => void | Promise<void>;
  onUpdate: (m: Module) => void | Promise<void>;
  onDelete: (id: string) => void | Promise<void>;
  onDuplicate: (m: Module) => void | Promise<void>;
  fragebogenList: Fragebogen[];
  onEditFb: (f: Fragebogen) => void | Promise<void>;
  onUpdateFb: (f: Fragebogen) => void | Promise<void>;
  onDeleteFb: (id: string) => void | Promise<void>;
  onDuplicateFb: (f: Fragebogen) => void | Promise<void>;
}

export const MhdCtx = createContext<MhdCtxValue>({
  modules: [],
  onEdit: () => {},
  onUpdate: () => {},
  onDelete: () => {},
  onDuplicate: () => {},
  fragebogenList: [],
  onEditFb: () => {},
  onUpdateFb: () => {},
  onDeleteFb: () => {},
  onDuplicateFb: () => {},
});

export function useMhdModules() {
  return useContext(MhdCtx);
}

// Fully isolated Durcharbeit question, module and questionnaire context.
export type DurcharbeitCtxValue = MhdCtxValue;

export const DurcharbeitCtx = createContext<DurcharbeitCtxValue>({
  modules: [],
  onEdit: () => {},
  onUpdate: () => {},
  onDelete: () => {},
  onDuplicate: () => {},
  fragebogenList: [],
  onEditFb: () => {},
  onUpdateFb: () => {},
  onDeleteFb: () => {},
  onDuplicateFb: () => {},
});

export function useDurcharbeitModules() {
  return useContext(DurcharbeitCtx);
}

// ── Flexbesuche context ────────────────────────────────────────
export interface FlexCtxValue {
  modules: Module[];
  onEdit: (m: Module) => void | Promise<void>;
  onUpdate: (m: Module) => void | Promise<void>;
  onDelete: (id: string) => void | Promise<void>;
  onDuplicate: (m: Module) => void | Promise<void>;
  duplicateModuleToStd: (m: Module) => void | Promise<void>;
  duplicateModuleToFlex: (m: Module) => void | Promise<void>;
  duplicateModuleToBilla: (m: Module) => void | Promise<void>;
  fragebogenList: Fragebogen[];
  onEditFb: (f: Fragebogen) => void | Promise<void>;
  onUpdateFb: (f: Fragebogen) => void | Promise<void>;
  onDeleteFb: (id: string) => void | Promise<void>;
  onDuplicateFb: (f: Fragebogen) => void | Promise<void>;
  duplicateFbToFlex: (f: Fragebogen) => void | Promise<void>;
  duplicateFbToStd: (f: Fragebogen) => void | Promise<void>;
  duplicateFbToBilla: (f: Fragebogen) => void | Promise<void>;
}

export const FlexCtx = createContext<FlexCtxValue>({
  modules: [],
  onEdit: () => {},
  onUpdate: () => {},
  onDelete: () => {},
  onDuplicate: () => {},
  duplicateModuleToStd: () => {},
  duplicateModuleToFlex: () => {},
  duplicateModuleToBilla: () => {},
  fragebogenList: [],
  onEditFb: () => {},
  onUpdateFb: () => {},
  onDeleteFb: () => {},
  onDuplicateFb: () => {},
  duplicateFbToFlex: () => {},
  duplicateFbToStd: () => {},
  duplicateFbToBilla: () => {},
});

export function useFlexModules() {
  return useContext(FlexCtx);
}

// ── Billa context ──────────────────────────────────────────────
export interface BillaCtxValue {
  modules: Module[];
  onEdit: (m: Module) => void | Promise<void>;
  onUpdate: (m: Module) => void | Promise<void>;
  onDelete: (id: string) => void | Promise<void>;
  onDuplicate: (m: Module) => void | Promise<void>;
  duplicateModuleToStd: (m: Module) => void | Promise<void>;
  duplicateModuleToFlex: (m: Module) => void | Promise<void>;
  duplicateModuleToBilla: (m: Module) => void | Promise<void>;
  fragebogenList: Fragebogen[];
  onEditFb: (f: Fragebogen) => void | Promise<void>;
  onUpdateFb: (f: Fragebogen) => void | Promise<void>;
  onDeleteFb: (id: string) => void | Promise<void>;
  onDuplicateFb: (f: Fragebogen) => void | Promise<void>;
  duplicateFbToStd: (f: Fragebogen) => void | Promise<void>;
  duplicateFbToFlex: (f: Fragebogen) => void | Promise<void>;
  duplicateFbToBilla: (f: Fragebogen) => void | Promise<void>;
}

export const BillaCtx = createContext<BillaCtxValue>({
  modules: [],
  onEdit: () => {},
  onUpdate: () => {},
  onDelete: () => {},
  onDuplicate: () => {},
  duplicateModuleToStd: () => {},
  duplicateModuleToFlex: () => {},
  duplicateModuleToBilla: () => {},
  fragebogenList: [],
  onEditFb: () => {},
  onUpdateFb: () => {},
  onDeleteFb: () => {},
  onDuplicateFb: () => {},
  duplicateFbToStd: () => {},
  duplicateFbToFlex: () => {},
  duplicateFbToBilla: () => {},
});

export function useBillaModules() {
  return useContext(BillaCtx);
}
