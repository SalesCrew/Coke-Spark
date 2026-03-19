"use client";

import { createContext, useContext } from "react";
import type { Module, Fragebogen } from "@/types/fragebogen";

// ── Kühlerinventur context ─────────────────────────────────────
export interface KuehlerCtxValue {
  modules: Module[];
  onEdit: (m: Module) => void;
  onUpdate: (m: Module) => void;
  onDelete: (id: string) => void;
  onDuplicate: (m: Module) => void;
  fragebogenList: Fragebogen[];
  onEditFb: (f: Fragebogen) => void;
  onDeleteFb: (id: string) => void;
  onDuplicateFb: (f: Fragebogen) => void;
}

export const KuehlerCtx = createContext<KuehlerCtxValue>({
  modules: [],
  onEdit: () => {},
  onUpdate: () => {},
  onDelete: () => {},
  onDuplicate: () => {},
  fragebogenList: [],
  onEditFb: () => {},
  onDeleteFb: () => {},
  onDuplicateFb: () => {},
});

export function useKuehlerModules() {
  return useContext(KuehlerCtx);
}

// ── MHD context ────────────────────────────────────────────────
export interface MhdCtxValue {
  modules: Module[];
  onEdit: (m: Module) => void;
  onUpdate: (m: Module) => void;
  onDelete: (id: string) => void;
  onDuplicate: (m: Module) => void;
  fragebogenList: Fragebogen[];
  onEditFb: (f: Fragebogen) => void;
  onDeleteFb: (id: string) => void;
  onDuplicateFb: (f: Fragebogen) => void;
}

export const MhdCtx = createContext<MhdCtxValue>({
  modules: [],
  onEdit: () => {},
  onUpdate: () => {},
  onDelete: () => {},
  onDuplicate: () => {},
  fragebogenList: [],
  onEditFb: () => {},
  onDeleteFb: () => {},
  onDuplicateFb: () => {},
});

export function useMhdModules() {
  return useContext(MhdCtx);
}

// ── Flexbesuche context ────────────────────────────────────────
export interface FlexCtxValue {
  modules: Module[];
  onEdit: (m: Module) => void;
  onUpdate: (m: Module) => void;
  onDelete: (id: string) => void;
  onDuplicate: (m: Module) => void;
  fragebogenList: Fragebogen[];
  onEditFb: (f: Fragebogen) => void;
  onDeleteFb: (id: string) => void;
  onDuplicateFb: (f: Fragebogen) => void;
  duplicateFbToFlex: (f: Fragebogen) => void;
  duplicateFbToStd: (f: Fragebogen) => void;
  duplicateFbToBilla: (f: Fragebogen) => void;
}

export const FlexCtx = createContext<FlexCtxValue>({
  modules: [],
  onEdit: () => {},
  onUpdate: () => {},
  onDelete: () => {},
  onDuplicate: () => {},
  fragebogenList: [],
  onEditFb: () => {},
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
  onEdit: (m: Module) => void;
  onUpdate: (m: Module) => void;
  onDelete: (id: string) => void;
  onDuplicate: (m: Module) => void;
  fragebogenList: Fragebogen[];
  onEditFb: (f: Fragebogen) => void;
  onDeleteFb: (id: string) => void;
  onDuplicateFb: (f: Fragebogen) => void;
  duplicateFbToStd: (f: Fragebogen) => void;
  duplicateFbToFlex: (f: Fragebogen) => void;
  duplicateFbToBilla: (f: Fragebogen) => void;
}

export const BillaCtx = createContext<BillaCtxValue>({
  modules: [],
  onEdit: () => {},
  onUpdate: () => {},
  onDelete: () => {},
  onDuplicate: () => {},
  fragebogenList: [],
  onEditFb: () => {},
  onDeleteFb: () => {},
  onDuplicateFb: () => {},
  duplicateFbToStd: () => {},
  duplicateFbToFlex: () => {},
  duplicateFbToBilla: () => {},
});

export function useBillaModules() {
  return useContext(BillaCtx);
}
