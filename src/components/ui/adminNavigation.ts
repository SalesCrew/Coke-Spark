import {
  ClipboardList,
  Refrigerator,
  FlaskConical,
  Zap,
  ShoppingBag,
  LayoutGrid,
  Gift,
  MapPin,
  UserCheck,
  Clock,
  TrendingUp,
  Warehouse,
  Gauge,
  Images,
  type LucideIcon,
} from "lucide-react";

export type AdminPageKey =
  | "gm_dashboard"
  | "ipp_berechnung"
  | "praemien"
  | "fragebogen"
  | "flexbesuche"
  | "billa"
  | "kuehlerinventur"
  | "mhd"
  | "fbmanagement"
  | "fotoarchiv"
  | "zeiterfassung"
  | "maerkte"
  | "lager"
  | "gebietsmanager"
  | "shelfmerchandizer";

export type AdminNavItem = {
  label: string;
  icon: LucideIcon;
  href: string;
  pageKey: AdminPageKey;
  color: {
    bg: string;
    ring: string;
    shadow: string;
  };
};

export type AdminNavGroup = {
  label: string;
  items: AdminNavItem[];
};

const cokeRed = {
  bg: "linear-gradient(to bottom, #DC2626, #e84040)",
  ring: "#c42020",
  shadow: "rgba(180,20,20,0.14)",
};

const darkRed = {
  bg: "linear-gradient(to bottom, #DC2626, #b91c1c)",
  ring: "#a91b1b",
  shadow: "rgba(180,20,20,0.14)",
};

export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    label: "Analyse",
    items: [
      { label: "GM Dashboard", icon: Gauge, href: "/admin/gm-dashboard", pageKey: "gm_dashboard", color: darkRed },
      { label: "IPP Berechnung", icon: TrendingUp, href: "/admin/ipp-berechnung", pageKey: "ipp_berechnung", color: darkRed },
    ],
  },
  {
    label: "Prämien",
    items: [{ label: "Prämien", icon: Gift, href: "/admin/praemien", pageKey: "praemien", color: darkRed }],
  },
  {
    label: "Fragebögen",
    items: [
      { label: "Standardbesuch", icon: ClipboardList, href: "/admin/fragebogen", pageKey: "fragebogen", color: cokeRed },
      { label: "Flexbesuche", icon: Zap, href: "/admin/flexbesuche", pageKey: "flexbesuche", color: { bg: "linear-gradient(to bottom, #84CC16, #65a30d)", ring: "#4d7c0f", shadow: "rgba(132,204,22,0.25)" } },
      { label: "Billa", icon: ShoppingBag, href: "/admin/billa", pageKey: "billa", color: { bg: "linear-gradient(to bottom, #0891B2, #0e7490)", ring: "#155e75", shadow: "rgba(8,145,178,0.25)" } },
      { label: "Kühlerinventur", icon: Refrigerator, href: "/admin/kuehlerinventur", pageKey: "kuehlerinventur", color: { bg: "linear-gradient(to bottom, #F59E0B, #D97706)", ring: "#B45309", shadow: "rgba(245,158,11,0.25)" } },
      { label: "MHD", icon: FlaskConical, href: "/admin/mhd", pageKey: "mhd", color: { bg: "linear-gradient(to bottom, #8b5cf6, #7C3AED)", ring: "#6d28d9", shadow: "rgba(124,58,237,0.25)" } },
      { label: "FB Management", icon: LayoutGrid, href: "/admin/fbmanagement", pageKey: "fbmanagement", color: cokeRed },
      { label: "Fotoarchiv", icon: Images, href: "/admin/fotoarchiv", pageKey: "fotoarchiv", color: cokeRed },
    ],
  },
  {
    label: "Management",
    items: [
      { label: "Zeiterfassung", icon: Clock, href: "/admin/zeiterfassung", pageKey: "zeiterfassung", color: cokeRed },
      { label: "Märkte", icon: MapPin, href: "/admin/maerkte", pageKey: "maerkte", color: cokeRed },
      { label: "Lager", icon: Warehouse, href: "/admin/lager", pageKey: "lager", color: cokeRed },
      { label: "Gebietsmanager", icon: UserCheck, href: "/admin/gebietsmanager", pageKey: "gebietsmanager", color: cokeRed },
      { label: "Shelf Merchandizer", icon: UserCheck, href: "/admin/shelfmerchandizer", pageKey: "shelfmerchandizer", color: cokeRed },
    ],
  },
];

export function getAdminPageKeyForPath(pathname: string): AdminPageKey | null {
  const allItems = ADMIN_NAV_GROUPS.flatMap((group) => group.items);
  const sorted = [...allItems].sort((a, b) => b.href.length - a.href.length);
  const match = sorted.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
  return match?.pageKey ?? null;
}

export function getFirstReadableAdminHref(canRead: (pageKey: AdminPageKey) => boolean): string | null {
  for (const group of ADMIN_NAV_GROUPS) {
    for (const item of group.items) {
      if (canRead(item.pageKey)) return item.href;
    }
  }
  return null;
}
