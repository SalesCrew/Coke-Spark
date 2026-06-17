"use client";

import { Calendar, Clock, Home, LogOut, Map, User } from "lucide-react";
import type { MenuItem } from "@/components/ui/CollapsibleMenu";

export const GM_MENU_ITEMS: MenuItem[] = [
  { label: "Home", href: "/gm", icon: <Home size={11} strokeWidth={1.8} /> },
  { label: "Gebiet", icon: <Map size={11} strokeWidth={1.8} /> },
  { label: "Zeiterfassung", href: "/gm/zeiterfassung", icon: <Clock size={11} strokeWidth={1.8} /> },
  { label: "Kalender", icon: <Calendar size={11} strokeWidth={1.8} /> },
  { label: "Profil", href: "/gm/profil", icon: <User size={11} strokeWidth={1.8} /> },
  { label: "Logout", icon: <LogOut size={11} strokeWidth={1.9} />, action: "logout", tone: "danger" },
];
