"use client";

import type { ComponentProps } from "react";
import { SmModuleEditor } from "./SmModuleEditor";
import { SMDurcharbeitTheme } from "./smQuestionnaireTheme";

// Share the complete SM question editor so special configurations stay identical.
export function SmDurcharbeitModuleEditor(props: ComponentProps<typeof SmModuleEditor>) {
  return <SmModuleEditor {...props} theme={SMDurcharbeitTheme} />;
}
