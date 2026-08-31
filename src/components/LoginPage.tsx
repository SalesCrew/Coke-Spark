"use client";

import { Inter_Tight } from "next/font/google";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Login from "@/components/Login";
import { fetchGmKpiSummary, loginWithBackend, saveAuthSession } from "@/lib/api/backend";

const loginFont = Inter_Tight({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export default function LoginPage() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash || "";
    const params = new URLSearchParams(window.location.search || "");
    const type = String(params.get("type") || "").toLowerCase();
    const hasRecoveryHash = /access_token=|type=recovery/i.test(hash);
    const hasRecoveryQuery = type === "recovery" || params.has("token_hash") || params.has("code");
    if (!hasRecoveryHash && !hasRecoveryQuery) return;

    const query = params.toString();
    router.replace(`/auth/reset-password${query ? `?${query}` : ""}${hash}`);
  }, [router]);

  return (
    <div className={loginFont.className}>
      <Login
        onSubmit={async ({ email, password, remember }) => {
          const result = await loginWithBackend({ email, password });

          saveAuthSession(result, { remember });

          if (result.user.role === "gm") {
            try {
              await fetchGmKpiSummary();
            } catch {
              // Keep login resilient even if KPI prefetch fails.
            }
            router.push("/gm");
            return;
          }

          if (result.user.role === "sm") {
            router.push("/sm");
            return;
          }

          if (result.user.role === "kunde") {
            router.push("/datenschutz/admin");
            return;
          }

          if (result.user.role === "sm_admin") {
            router.push("/admin/sm/dashboard");
            return;
          }

          router.push("/admin");
        }}
        onForgot={(email) => {
          const query = email ? `?email=${encodeURIComponent(email)}` : "";
          router.push(`/auth/passwort-vergessen${query}`);
        }}
      />
    </div>
  );
}
