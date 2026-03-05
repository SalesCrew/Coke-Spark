import {
  CircleDot,
  ToggleLeft,
  ListChecks,
  CheckSquare,
  Star,
  AlignLeft,
  Hash,
  SlidersHorizontal,
  Camera,
  Grid3x3,
} from "lucide-react";
import type { QuestionType } from "@/types/fragebogen";

export const QUESTION_TYPES: {
  key: QuestionType;
  label: string;
  icon: typeof CircleDot;
}[] = [
  { key: "single", label: "Single Choice", icon: CircleDot },
  { key: "yesno", label: "Ja / Nein", icon: ToggleLeft },
  { key: "yesnomulti", label: "Ja / Nein Multi", icon: ListChecks },
  { key: "multiple", label: "Multiple Choice", icon: CheckSquare },
  { key: "likert", label: "Likert Skala", icon: Star },
  { key: "text", label: "Offener Text", icon: AlignLeft },
  { key: "numeric", label: "Offene Zahl", icon: Hash },
  { key: "slider", label: "Slider", icon: SlidersHorizontal },
  { key: "photo", label: "Foto Upload", icon: Camera },
  { key: "matrix", label: "Matrix", icon: Grid3x3 },
];

export function typeLabel(t: QuestionType): string {
  return QUESTION_TYPES.find((q) => q.key === t)?.label ?? t;
}

export function typeBadgeColor(t: QuestionType): { bg: string; text: string } {
  switch (t) {
    case "single":
      return { bg: "rgba(220,38,38,0.07)", text: "#DC2626" };
    case "yesno":
      return { bg: "rgba(5,150,105,0.07)", text: "#059669" };
    case "yesnomulti":
      return { bg: "rgba(13,148,136,0.07)", text: "#0d9488" };
    case "multiple":
      return { bg: "rgba(59,130,246,0.07)", text: "#2563eb" };
    case "likert":
      return { bg: "rgba(234,179,8,0.08)", text: "#a16207" };
    case "text":
      return { bg: "rgba(107,114,128,0.07)", text: "#4b5563" };
    case "numeric":
      return { bg: "rgba(139,92,246,0.07)", text: "#7c3aed" };
    case "slider":
      return { bg: "rgba(236,72,153,0.07)", text: "#db2777" };
    case "photo":
      return { bg: "rgba(14,165,233,0.07)", text: "#0284c7" };
    case "matrix":
      return { bg: "rgba(194,65,12,0.07)", text: "#c2410c" };
  }
}

export function defaultConfig(t: QuestionType): Record<string, unknown> {
  switch (t) {
    case "single":
    case "multiple":
      return { options: ["", ""] };
    case "yesnomulti":
      return { answers: ["Ja", "Nein"], triggerAnswer: "Ja", options: ["", ""] };
    case "likert":
      return { min: "", max: "", minLabel: "", maxLabel: "" };
    case "numeric":
      return { min: "", max: "", decimals: false };
    case "slider":
      return { min: "", max: "", step: "", unit: "" };
    case "photo":
      return { instruction: "" };
    case "matrix":
      return { rows: [""], columns: ["", ""] };
    default:
      return {};
  }
}
