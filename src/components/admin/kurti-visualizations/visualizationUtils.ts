import type {
  AdminKurtiVisualizationTone,
  AdminKurtiVisualizationValueFormat,
} from "@/lib/api/backend";

export const TONE_COLORS: Record<AdminKurtiVisualizationTone, string> = {
  red: "#dc2626",
  slate: "#64748b",
  amber: "#d97706",
  emerald: "#059669",
  blue: "#2563eb",
  violet: "#7c3aed",
  cyan: "#0891b2",
  pink: "#db2777",
};

export function formatVisualizationValue(value: number, format: AdminKurtiVisualizationValueFormat): string {
  if (format === "currency") {
    return new Intl.NumberFormat("de-AT", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(value);
  }
  if (format === "percent") {
    return `${new Intl.NumberFormat("de-AT", { maximumFractionDigits: 1 }).format(value)} %`;
  }
  if (format === "duration_minutes") {
    const rounded = Math.round(value);
    const sign = rounded < 0 ? "−" : "";
    const absolute = Math.abs(rounded);
    return `${sign}${Math.floor(absolute / 60)} h ${String(absolute % 60).padStart(2, "0")} min`;
  }
  if (format === "duration_hours") {
    return `${new Intl.NumberFormat("de-AT", { maximumFractionDigits: 2 }).format(value)} h`;
  }
  return new Intl.NumberFormat("de-AT", {
    maximumFractionDigits: format === "number" ? 0 : 2,
  }).format(value);
}

export function paddedDomain(values: number[], includeZero = false): { min: number; max: number } | null {
  if (!values.length) return null;
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (includeZero) {
    min = Math.min(0, min);
    max = Math.max(0, max);
  }
  if (min === max) {
    const padding = Math.max(Math.abs(min) * 0.12, 1);
    return { min: min - padding, max: max + padding };
  }
  const padding = (max - min) * 0.08;
  return { min: min - padding, max: max + padding };
}
