"use client";

import { Activity, Clock, Home, LogOut, User } from "lucide-react";
import type { MenuItem } from "@/components/ui/CollapsibleMenu";

export const GM_MENU_ITEMS: MenuItem[] = [
  { label: "Home", href: "/gm", icon: <Home size={11} strokeWidth={1.8} /> },
  { label: "Aktivität", href: "/gm/aktivitaet", icon: <Activity size={11} strokeWidth={1.8} />, isNew: true },
  { label: "Zeiterfassung", href: "/gm/zeiterfassung", icon: <Clock size={11} strokeWidth={1.8} />, isNew: true },
  { label: "Profil", href: "/gm/profil", icon: <User size={11} strokeWidth={1.8} />, isNew: true },
  { label: "Logout", icon: <LogOut size={11} strokeWidth={1.9} />, action: "logout", tone: "danger" },
];
