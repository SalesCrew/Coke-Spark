"use client";

import { Activity, Clock, Home, LogOut, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { CollapsibleMenu, type MenuItem } from "@/components/ui/CollapsibleMenu";
import { StatusCard } from "@/components/dashboard/StatusCard";
import { NachrichtenCard } from "@/components/dashboard/NachrichtenCard";
import { SmDashboardSchedule } from "@/components/dashboard/SmDashboardSchedule";
import { logoutCurrentUser } from "@/lib/api/backend";

const SM_MENU_ITEMS: MenuItem[] = [
  { label: "Home", href: "/sm", icon: <Home size={11} strokeWidth={1.8} /> },
  { label: "Aktivitäten", href: "/sm/aktivitaet", icon: <Activity size={11} strokeWidth={1.8} /> },
  { label: "Zeiterfassung", href: "/sm/zeiterfassung", icon: <Clock size={11} strokeWidth={1.8} /> },
  { label: "Profil", href: "/sm/profil", icon: <User size={11} strokeWidth={1.8} /> },
  { label: "Logout", icon: <LogOut size={11} strokeWidth={1.9} />, action: "logout", tone: "danger" },
];

export default function SMDashboard() {
  const router = useRouter();
  return (
    <main className="min-h-screen" style={{ backgroundColor: "#f5f5f7" }}>
      <div className="px-6 pt-6" style={{ maxWidth: 420, margin: "0 auto" }}>
        <StatusCard />
        <SmDashboardSchedule />
        <div className="mt-4 px-1">
          <NachrichtenCard />
        </div>
      </div>

      <div className="fixed bottom-6 left-0 right-0 z-50">
        <CollapsibleMenu
          items={SM_MENU_ITEMS}
          enableKurti
          featureKurti={false}
          kurtiMaxWidth={420}
          enableClickToggle
          defaultIndex={0}
          onSelect={(_index, item) => {
            if (item.action === "logout") {
              logoutCurrentUser();
              if (typeof window !== "undefined") {
                window.location.assign("/");
                return;
              }
              router.replace("/");
              router.refresh();
              return;
            }
            if (item.href) {
              router.push(item.href);
            }
          }}
        />
      </div>
    </main>
  );
}
