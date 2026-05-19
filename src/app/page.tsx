"use client";

import { Inter_Tight } from "next/font/google";
import { useRouter } from "next/navigation";
import Login from "@/components/Login";
import { fetchGmKpiSummary, loginWithBackend, saveAuthSession, type LoginRole } from "@/lib/api/backend";

const loginFont = Inter_Tight({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const LOGIN_ROLES: Array<Exclude<LoginRole, "coke">> = ["gm", "sm", "admin"];

export default function Home() {
  const router = useRouter();

  return (
    <div className={loginFont.className}>
      <Login
        onSubmit={async ({ email, password }) => {
          let result: Awaited<ReturnType<typeof loginWithBackend>> | null = null;
          let lastError: unknown = null;

          for (const role of LOGIN_ROLES) {
            try {
              result = await loginWithBackend({ email, password, role });
              break;
            } catch (error) {
              lastError = error;
            }
          }

          if (!result) {
            throw (lastError instanceof Error ? lastError : new Error("Login fehlgeschlagen."));
          }

          saveAuthSession(result);

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

          router.push("/admin");
        }}
        onForgot={() => {
          router.push("/");
        }}
      />
    </div>
  );
}
