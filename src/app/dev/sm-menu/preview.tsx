"use client";

import { useEffect, useState } from "react";
import { Activity, Clock, Home, LogOut, User } from "lucide-react";
import { CollapsibleMenu, type MenuItem } from "@/components/ui/CollapsibleMenu";

const ITEMS: MenuItem[] = [
  { label: "Home", href: "/sm", icon: <Home size={11} /> },
  { label: "Aktivitäten", href: "/sm/aktivitaet", icon: <Activity size={11} /> },
  { label: "Zeiterfassung", href: "/sm/zeiterfassung", icon: <Clock size={11} /> },
  { label: "Profil", href: "/sm/profil", icon: <User size={11} /> },
  { label: "Logout", action: "logout", icon: <LogOut size={11} />, tone: "danger" },
];

export default function Preview() {
  const [active, setActive] = useState(0);
  const [visits, setVisits] = useState(0);
  const [ready, setReady] = useState(false);
  useEffect(() => { setReady(true); }, []);
  return <main data-menu-ready={ready} className="min-h-dvh bg-[#f5f5f7] p-6 text-sm">
    <h1 className="font-semibold">SM Menü · lokale Prüfung</h1>
    <p className="mt-2 text-xs text-black/40">Echtes Menü, simulierte Seitenwechsel. Keine Datenbankzugriffe.</p>
    <p className="mt-6" data-testid="current-page">{ITEMS[active].label}</p>
    <p data-testid="navigation-count">Seitenwechsel: {visits}</p>
    <div className="fixed bottom-6 left-0 right-0 z-50">
      <CollapsibleMenu key={visits} items={ITEMS} defaultIndex={active} enableClickToggle enableKurti featureKurti={false} kurtiMaxWidth={420} onSelect={(index) => { setActive(index); setVisits((count) => count + 1); }} />
    </div>
  </main>;
}
