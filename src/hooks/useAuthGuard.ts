"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  readAuthSession,
  resolveRoleHomePath,
  subscribeAuthSession,
  type AuthSessionPayload,
} from "@/lib/api/backend";

type GuardRole = "admin" | "gm" | "sm" | "kunde";
type GuardStatus = "checking" | "authorized" | "redirecting";

export function useAuthGuard(requiredRole: GuardRole | GuardRole[] | null): {
  session: AuthSessionPayload | null;
  status: GuardStatus;
} {
  const router = useRouter();
  const [session, setSession] = useState<AuthSessionPayload | null>(null);
  const [status, setStatus] = useState<GuardStatus>("checking");
  const redirectRef = useRef<string | null>(null);
  const requiredRoleKey = Array.isArray(requiredRole)
    ? requiredRole.join("|")
    : requiredRole ?? "";

  const revalidate = useCallback(() => {
    const current = readAuthSession();
    setSession(current);
    if (!current) {
      setStatus("redirecting");
      if (redirectRef.current !== "/") {
        redirectRef.current = "/";
        router.replace("/");
      }
      return;
    }

    const allowedRoles = requiredRoleKey ? (requiredRoleKey.split("|") as GuardRole[]) : null;
    if (allowedRoles && !allowedRoles.includes(current.user.role)) {
      const target = resolveRoleHomePath(current.user.role);
      setStatus("redirecting");
      if (redirectRef.current !== target) {
        redirectRef.current = target;
        router.replace(target);
      }
      return;
    }

    redirectRef.current = null;
    setStatus("authorized");
  }, [requiredRoleKey, router]);

  useEffect(() => {
    revalidate();
  }, [revalidate]);

  useEffect(() => {
    return subscribeAuthSession(revalidate);
  }, [revalidate]);

  useEffect(() => {
    const onFocus = () => revalidate();
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        revalidate();
      }
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [revalidate]);

  return { session, status };
}
