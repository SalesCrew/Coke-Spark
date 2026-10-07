"use client";

import { SmFragebogenWorkspace } from "./SmFragebogenWorkspace";
import { SmDurcharbeitModuleEditor } from "./SmDurcharbeitModuleEditor";
import { SmDurcharbeitFragebogenEditor } from "./SmDurcharbeitFragebogenEditor";

export function SmDurcharbeitWorkspace() {
  return <SmFragebogenWorkspace
    scope="SMDurcharbeit"
    ModuleEditor={SmDurcharbeitModuleEditor}
    QuestionnaireEditor={SmDurcharbeitFragebogenEditor}
  />;
}
