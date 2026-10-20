import {
  BookOpen,
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
  ShieldCheck,
  ClipboardCheck,
  MessageSquareText,
  CalendarRange,
  type LucideIcon,
} from "lucide-react";

export type AdminPageKey =
  | "gm_dashboard"
  | "wochenschwerpunkte"
  | "datenschutzanfragen"
  | "ipp_berechnung"
  | "praemien"
  | "fragebogen"
  | "flexbesuche"
  | "billa"
  | "kuehlerinventur"
  | "mhd"
  | "durcharbeit"
  | "fbmanagement"
  | "fotoarchiv"
  | "zeiterfassung"
  | "maerkte"
  | "lager"
  | "gebietsmanager"
  | "shelfmerchandiser"
  | "sm_dashboard"
  | "sm_fragebogen"
  | "sm_durcharbeit"
  | "sm_fbmanagement"
  | "sm_fotoarchiv"
  | "sm_verplanung"
  | "sm_durcharbeit_verplanung"
  | "sm_zeiterfassung"
  | "sm_maerkte"
  | "sm_durcharbeit_maerkte"
  | "sm_nachrichten";

export type AdminWorkspace = "gm" | "sm";

export type AdminNavItem = {
  label: string;
  icon: LucideIcon;
  href: string;
  pageKey: AdminPageKey;
  workspace?: AdminWorkspace;
  adminOnly?: boolean;
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
      { label: "SM Dashboard", icon: Gauge, href: "/admin/sm/dashboard", pageKey: "sm_dashboard", workspace: "sm", color: darkRed },
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
      { label: "Durcharbeit", icon: ClipboardCheck, href: "/admin/durcharbeit", pageKey: "durcharbeit", color: { bg: "linear-gradient(to bottom, #2563EB, #1D4ED8)", ring: "#1E40AF", shadow: "rgba(37,99,235,0.24)" } },
      { label: "FB Management", icon: LayoutGrid, href: "/admin/fbmanagement", pageKey: "fbmanagement", color: cokeRed },
      { label: "Fotoarchiv", icon: Images, href: "/admin/fotoarchiv", pageKey: "fotoarchiv", color: cokeRed },
      { label: "Standartfragebogen", icon: ClipboardList, href: "/admin/sm/fragebogen", pageKey: "sm_fragebogen", workspace: "sm", color: cokeRed },
      { label: "Durcharbeit", icon: ClipboardCheck, href: "/admin/sm/durcharbeit", pageKey: "sm_durcharbeit", workspace: "sm", color: { bg: "linear-gradient(to bottom, #2563EB, #1D4ED8)", ring: "#1E40AF", shadow: "rgba(37,99,235,0.24)" } },
      { label: "FB Management", icon: LayoutGrid, href: "/admin/sm/fbmanagement", pageKey: "sm_fbmanagement", workspace: "sm", color: cokeRed },
      { label: "Fotoarchiv", icon: Images, href: "/admin/sm/fotoarchiv", pageKey: "sm_fotoarchiv", workspace: "sm", color: cokeRed },
    ],
  },
  {
    label: "Management",
    items: [
      { label: "Wochenschwerpunkte", icon: BookOpen, href: "/admin/wochenschwerpunkte", pageKey: "wochenschwerpunkte", color: cokeRed },
      { label: "Verplanung", icon: CalendarRange, href: "/admin/sm/verplanung", pageKey: "sm_verplanung", workspace: "sm", color: cokeRed },
      { label: "Durcharbeit Verplanung", icon: CalendarRange, href: "/admin/sm/durcharbeit-verplanung", pageKey: "sm_durcharbeit_verplanung", workspace: "sm", color: { bg: "linear-gradient(to bottom, #2563EB, #1D4ED8)", ring: "#1E40AF", shadow: "rgba(37,99,235,0.24)" } },
      { label: "Zeiterfassung", icon: Clock, href: "/admin/sm/zeiterfassung", pageKey: "sm_zeiterfassung", workspace: "sm", color: cokeRed },
      { label: "Zeiterfassung", icon: Clock, href: "/admin/zeiterfassung", pageKey: "zeiterfassung", color: cokeRed },
      { label: "Märkte", icon: MapPin, href: "/admin/maerkte", pageKey: "maerkte", color: cokeRed },
      { label: "Lager", icon: Warehouse, href: "/admin/lager", pageKey: "lager", color: cokeRed },
      { label: "Gebietsmanager", icon: UserCheck, href: "/admin/gebietsmanager", pageKey: "gebietsmanager", color: cokeRed },
      { label: "Märkte", icon: MapPin, href: "/admin/sm/maerkte", pageKey: "sm_maerkte", workspace: "sm", color: cokeRed },
      { label: "Durcharbeit Märkte", icon: MapPin, href: "/admin/sm/durcharbeit-maerkte", pageKey: "sm_durcharbeit_maerkte", workspace: "sm", color: { bg: "linear-gradient(to bottom, #2563EB, #1D4ED8)", ring: "#1E40AF", shadow: "rgba(37,99,235,0.24)" } },
      { label: "Shelf Merchandiser", icon: UserCheck, href: "/admin/shelfmerchandiser", pageKey: "shelfmerchandiser", workspace: "sm", color: cokeRed },
      { label: "Nachrichten", icon: MessageSquareText, href: "/admin/sm/nachrichten", pageKey: "sm_nachrichten", workspace: "sm", color: cokeRed },
      { label: "Datenschutz", icon: ShieldCheck, href: "/admin/datenschutzanfragen", pageKey: "datenschutzanfragen", adminOnly: true, color: cokeRed },
    ],
  },
];

export function getAdminPageKeyForPath(pathname: string): AdminPageKey | null {
  const allItems = ADMIN_NAV_GROUPS.flatMap((group) => group.items);
  const sorted = [...allItems].sort((a, b) => b.href.length - a.href.length);
  const match = sorted.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
  return match?.pageKey ?? null;
}

export function getAdminWorkspaceForPath(pathname: string): AdminWorkspace {
  const allItems = ADMIN_NAV_GROUPS.flatMap((group) => group.items);
  const sorted = [...allItems].sort((a, b) => b.href.length - a.href.length);
  const match = sorted.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
  return match?.workspace ?? "gm";
}

export function getFirstReadableAdminHref(canRead: (pageKey: AdminPageKey) => boolean): string | null {
  for (const group of ADMIN_NAV_GROUPS) {
    for (const item of group.items) {
      if (!item.adminOnly && canRead(item.pageKey)) return item.href;
    }
  }
  return null;
}

/** The existing customer permission catalog, split without changing stored GM keys. */
export function getCustomerPermissionGroups(workspace?: AdminWorkspace): AdminNavGroup[] {
  return ADMIN_NAV_GROUPS.map(group => ({ ...group, items: group.items.filter(item => !item.adminOnly && (!workspace || (item.workspace ?? "gm") === workspace)) })).filter(group => group.items.length > 0);
}

/** Clear only the workspace currently being edited; keep the account's other grants. */
export function clearCustomerWorkspacePermissions<T extends Record<string, unknown>>(permissions: T, workspace: AdminWorkspace): T {
  const next = { ...permissions };
  for (const group of getCustomerPermissionGroups(workspace)) {
    for (const item of group.items) delete next[item.pageKey];
  }
  return next;
}
