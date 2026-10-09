"use client";

import { Activity, Clock, Home, LogOut, User } from "lucide-react";
import { useRouter } from "next/navigation";
import type { MenuItem } from "@/components/ui/CollapsibleMenu";
import { logoutCurrentUser } from "@/lib/api/backend";
import { SmHomeMenu } from "./SmHomeMenu";

const items: MenuItem[] = [
  { label: "Home", href: "/sm", icon: <Home size={11} strokeWidth={1.8} /> },
  { label: "Aktivitäten", href: "/sm/aktivitaet", icon: <Activity size={11} strokeWidth={1.8} /> },
  { label: "Zeiterfassung", href: "/sm/zeiterfassung", icon: <Clock size={11} strokeWidth={1.8} /> },
  { label: "Profil", href: "/sm/profil", icon: <User size={11} strokeWidth={1.8} /> },
  { label: "Logout", icon: <LogOut size={11} strokeWidth={1.9} />, action: "logout", tone: "danger" },
];

export function SmDashboardNavigation() {
  const router = useRouter();
  return <SmHomeMenu items={items} enableKurti featureKurti={false} kurtiMaxWidth={420} enableClickToggle defaultIndex={0}
    onSelect={(_index, item) => {
      if (item.action === "logout") {
        logoutCurrentUser();
        window.location.assign("/");
        return;
      }
      if (item.href) router.push(item.href);
    }} />;
}
