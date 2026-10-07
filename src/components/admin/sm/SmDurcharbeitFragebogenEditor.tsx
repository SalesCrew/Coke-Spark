"use client";

import type { ComponentProps } from "react";
import { SmFragebogenEditor } from "./SmFragebogenEditor";
import { SMDurcharbeitTheme } from "./smQuestionnaireTheme";

export function SmDurcharbeitFragebogenEditor(props: ComponentProps<typeof SmFragebogenEditor>) {
  return <SmFragebogenEditor {...props} theme={SMDurcharbeitTheme} />;
}
