export type FuellstandTypeKey = "cooler" | "singleServe" | "multiServe" | "promos" | "warehouse";

export const FUELLSTAND_TYPE_CONFIG: Array<{
  key: FuellstandTypeKey;
  label: string;
  stroke: string;
  pillBackground: string;
  pillBorder: string;
  pillText: string;
}> = [
  {
    key: "cooler",
    label: "Cooler",
    stroke: "#2563EB",
    pillBackground: "rgba(37,99,235,0.10)",
    pillBorder: "rgba(37,99,235,0.28)",
    pillText: "rgba(30,64,175,0.90)",
  },
  {
    key: "singleServe",
    label: "SingleServe",
    stroke: "#0EA5A4",
    pillBackground: "rgba(14,165,164,0.10)",
    pillBorder: "rgba(14,165,164,0.28)",
    pillText: "rgba(15,118,110,0.9)",
  },
  {
    key: "multiServe",
    label: "MultiServe",
    stroke: "#7C3AED",
    pillBackground: "rgba(124,58,237,0.10)",
    pillBorder: "rgba(124,58,237,0.26)",
    pillText: "rgba(91,33,182,0.9)",
  },
  {
    key: "promos",
    label: "Promos",
    stroke: "#EA580C",
    pillBackground: "rgba(234,88,12,0.10)",
    pillBorder: "rgba(234,88,12,0.28)",
    pillText: "rgba(194,65,12,0.92)",
  },
  {
    key: "warehouse",
    label: "Warehouse",
    stroke: "#475569",
    pillBackground: "rgba(71,85,105,0.10)",
    pillBorder: "rgba(71,85,105,0.28)",
    pillText: "rgba(51,65,85,0.92)",
  },
];
