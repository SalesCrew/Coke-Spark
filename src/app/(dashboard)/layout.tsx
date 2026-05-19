"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { readAuthSession } from "@/lib/api/backend";

function resolveRoleHome(role: "admin" | "gm" | "sm"): string {
  if (role === "admin") return "/admin";
  if (role === "gm") return "/gm";
  return "/sm";
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const session = readAuthSession();
    if (!session) {
      router.replace("/");
      return;
    }

    const requiredRole = pathname.startsWith("/gm") ? "gm" : pathname.startsWith("/sm") ? "sm" : null;
    if (requiredRole && session.user.role !== requiredRole) {
      router.replace(resolveRoleHome(session.user.role));
      return;
    }

    setAuthChecked(true);
  }, [pathname, router]);

  if (!authChecked) return null;
  return <>{children}</>;
}
