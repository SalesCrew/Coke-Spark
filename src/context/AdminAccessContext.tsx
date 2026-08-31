"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { AuthSessionPayload, CustomerPagePermissions } from "@/lib/api/backend";
import { fetchCurrentAuthUser, saveAuthSession } from "@/lib/api/backend";
import {
  getAdminPageKeyForPath,
  getFirstReadableAdminHref,
  type AdminPageKey,
} from "@/components/ui/adminNavigation";

type AdminAccessContextValue = {
  role: AuthSessionPayload["user"]["role"] | null;
  permissions: CustomerPagePermissions;
  canRead: (pageKey: AdminPageKey) => boolean;
  canWrite: (pageKey: AdminPageKey) => boolean;
  canUpdate: (pageKey: AdminPageKey) => boolean;
  firstReadableHref: string | null;
  currentPageKey: AdminPageKey | null;
  isAdmin: boolean;
  isSmAdmin: boolean;
  isKunde: boolean;
};

const AdminAccessContext = createContext<AdminAccessContextValue | null>(null);

function normalizePermissions(input: unknown): CustomerPagePermissions {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  return Object.entries(input as Record<string, unknown>).reduce<CustomerPagePermissions>((acc, [pageKey, rawActions]) => {
    if (!Array.isArray(rawActions)) return acc;
    const actions = rawActions.filter((entry): entry is "read" | "write" | "update" =>
      entry === "read" || entry === "write" || entry === "update",
    );
    if (actions.length > 0) acc[pageKey] = Array.from(new Set(actions));
    return acc;
  }, {});
}

export function AdminAccessProvider({
  session,
  pathname,
  children,
}: {
  session: AuthSessionPayload | null;
  pathname: string;
  children: React.ReactNode;
}) {
  const [livePermissions, setLivePermissions] = useState<CustomerPagePermissions>(() =>
    normalizePermissions(session?.user.permissions),
  );
  const sessionPermissionSignature = JSON.stringify(session?.user.permissions ?? {});

  useEffect(() => {
    setLivePermissions(normalizePermissions(session?.user.permissions));
  }, [session?.user.id, session?.user.permissions]);

  useEffect(() => {
    if (!session || session.user.role !== "kunde") return;
    let cancelled = false;
    fetchCurrentAuthUser()
      .then((user) => {
        if (cancelled) return;
        const permissions = normalizePermissions(user.permissions);
        const nextSignature = JSON.stringify(permissions);
        setLivePermissions(permissions);
        if (nextSignature !== sessionPermissionSignature) {
          saveAuthSession({
            ...session,
            user: {
              ...session.user,
              permissions,
            },
          });
        }
      })
      .catch(() => {
        // Keep the session payload as a safe fallback; backend remains authoritative.
      });
    return () => {
      cancelled = true;
    };
  }, [session, sessionPermissionSignature]);

  const isSmAdmin = session?.user.role === "sm_admin";
  // SM admins are full administrators; their default workspace is SM, not their permission boundary.
  const isAdmin = session?.user.role === "admin" || isSmAdmin;
  const isKunde = session?.user.role === "kunde";

  const can = useCallback(
    (pageKey: AdminPageKey, action: "read" | "write" | "update") => {
      if (isAdmin) return true;
      if (!isKunde) return false;
      return (livePermissions[pageKey] ?? []).includes(action);
    },
    [isAdmin, isKunde, livePermissions],
  );

  const value = useMemo<AdminAccessContextValue>(() => {
    const canRead = (pageKey: AdminPageKey) => can(pageKey, "read");
    return {
      role: session?.user.role ?? null,
      permissions: livePermissions,
      canRead,
      canWrite: (pageKey) => can(pageKey, "write"),
      canUpdate: (pageKey) => can(pageKey, "update"),
      firstReadableHref: isSmAdmin ? "/admin/sm/dashboard" : isAdmin ? "/admin/gm-dashboard" : getFirstReadableAdminHref(canRead),
      currentPageKey: getAdminPageKeyForPath(pathname),
      isAdmin,
      isSmAdmin,
      isKunde,
    };
  }, [can, isAdmin, isSmAdmin, livePermissions, pathname, session?.user.role]);

  return <AdminAccessContext.Provider value={value}>{children}</AdminAccessContext.Provider>;
}

export function useAdminAccess(): AdminAccessContextValue {
  const context = useContext(AdminAccessContext);
  if (!context) {
    return {
      role: null,
      permissions: {},
      canRead: () => false,
      canWrite: () => false,
      canUpdate: () => false,
      firstReadableHref: null,
      currentPageKey: null,
      isAdmin: false,
      isSmAdmin: false,
      isKunde: false,
    };
  }
  return context;
}
