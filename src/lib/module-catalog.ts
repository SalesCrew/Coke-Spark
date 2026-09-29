import type { Module } from "@/types/fragebogen";

export function sortCatalogModules(modules: Module[]): Module[] {
  // Stable partition: restore the original order when a module is reinstated.
  return [...modules.filter((module) => !module.catalogInactive), ...modules.filter((module) => module.catalogInactive)];
}
