import type { CSSProperties } from "react";

export type SmQuestionnaireTheme = {
  accent: string;
  accentDark: string;
  accentLight: string;
  accentBorder: string;
  accentRgb: string;
};

export const SMDurcharbeitTheme: SmQuestionnaireTheme = {
  accent: "#2563EB",
  accentDark: "#1D4ED8",
  accentLight: "#3B82F6",
  accentBorder: "#1E40AF",
  accentRgb: "37,99,235",
};

const standardTheme: SmQuestionnaireTheme = {
  accent: "#DC2626",
  accentDark: "#b91c1c",
  accentLight: "#e84040",
  accentBorder: "#a91b1b",
  accentRgb: "220,38,38",
};

export function smQuestionnaireThemeStyle(theme: SmQuestionnaireTheme = standardTheme): CSSProperties {
  return {
    "--module-accent": theme.accent,
    "--module-accent-dark": theme.accentDark,
    "--module-accent-light": theme.accentLight,
    "--module-accent-border": theme.accentBorder,
    "--module-accent-rgb": theme.accentRgb,
  } as CSSProperties;
}
