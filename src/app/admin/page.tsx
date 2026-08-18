"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { readAuthSession } from "@/lib/api/backend";

export default function AdminPage() {
  const router = useRouter();

  useEffect(() => {
    const role = readAuthSession()?.user.role;
    router.replace(role === "sm_admin" ? "/admin/sm/dashboard" : "/admin/fragebogen");
  }, [router]);

  return null;
}
