"use client";

import { type ReactNode, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { fetchCurrentEmployeeAgreement } from "@/lib/api/backend";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const requiredRole = pathname.startsWith("/gm") ? "gm" : pathname.startsWith("/sm") ? "sm" : null;
  const { session, status } = useAuthGuard(requiredRole);
  const [agreementStatus, setAgreementStatus] = useState<"idle" | "checking" | "authorized" | "redirecting">("idle");

  useEffect(() => {
    if (status !== "authorized") {
      setAgreementStatus("idle");
      return;
    }

    const role = session?.user.role;
    if (role !== "gm" && role !== "sm") {
      setAgreementStatus("authorized");
      return;
    }

    let cancelled = false;
    setAgreementStatus("checking");
    fetchCurrentEmployeeAgreement()
      .then((payload) => {
        if (cancelled) return;
        if (payload.accepted) {
          setAgreementStatus("authorized");
          return;
        }

        setAgreementStatus("redirecting");
        const nextPath = typeof window !== "undefined"
          ? `${window.location.pathname}${window.location.search}`
          : pathname;
        router.replace(`/vereinbarung?next=${encodeURIComponent(nextPath)}`);
      })
      .catch(() => {
        if (cancelled) return;
        setAgreementStatus("redirecting");
        const nextPath = typeof window !== "undefined"
          ? `${window.location.pathname}${window.location.search}`
          : pathname;
        router.replace(`/vereinbarung?next=${encodeURIComponent(nextPath)}`);
      });

    return () => {
      cancelled = true;
    };
  }, [pathname, router, session?.user.id, session?.user.role, status]);

  if (status !== "authorized" || agreementStatus !== "authorized") {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#f5f5f7" }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: "rgba(0,0,0,0.45)" }}>
          {status !== "authorized" ? "Authentifizierung wird geprüft..." : "Vereinbarung wird geprüft..."}
        </p>
      </main>
    );
  }

  return <>{children}</>;
}
