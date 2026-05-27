"use client";

import { type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useAuthGuard } from "@/hooks/useAuthGuard";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const requiredRole = pathname.startsWith("/gm") ? "gm" : pathname.startsWith("/sm") ? "sm" : null;
  const { status } = useAuthGuard(requiredRole);

  if (status !== "authorized") {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#f5f5f7" }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: "rgba(0,0,0,0.45)" }}>Authentifizierung wird geprüft...</p>
      </main>
    );
  }
  return <>{children}</>;
}
