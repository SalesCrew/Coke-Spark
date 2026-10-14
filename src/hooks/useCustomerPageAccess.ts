"use client";

import { useAdminAccess } from "@/context/AdminAccessContext";
import type { AdminPageKey } from "@/components/ui/adminNavigation";

/** Full admin/worker rendering stays unchanged; customers use their exact page grants. */
export function useCustomerPageAccess(pageKey?: AdminPageKey) {
  const access = useAdminAccess();
  const key = pageKey ?? access.currentPageKey;
  return {
    canRead: !access.isKunde || Boolean(key && access.canRead(key)),
    canWrite: !access.isKunde || Boolean(key && access.canWrite(key)),
    canUpdate: !access.isKunde || Boolean(key && access.canUpdate(key)),
    isCustomer: access.isKunde,
  };
}
