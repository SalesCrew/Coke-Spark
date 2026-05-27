"use client";

import { Inter_Tight } from "next/font/google";
import { useRouter } from "next/navigation";
import Login from "@/components/Login";
import { fetchGmKpiSummary, loginWithBackend, saveAuthSession } from "@/lib/api/backend";

const loginFont = Inter_Tight({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export default function Home() {
  const router = useRouter();

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

          router.push("/admin");
        }}
        onForgot={() => {
          router.push("/");
        }}
      />
    </div>
  );
}
