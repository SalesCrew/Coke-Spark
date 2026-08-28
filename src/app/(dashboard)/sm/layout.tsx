"use client";

import { GmTextScaleProvider } from "@/components/dashboard/GmTextScaleProvider";
import { SmPausedVisitNoticeProvider } from "@/components/sm/SmPausedVisitNotice";

export default function SmLayout({ children }: { children: React.ReactNode }) {
  return <GmTextScaleProvider scope="sm"><SmPausedVisitNoticeProvider>{children}</SmPausedVisitNoticeProvider></GmTextScaleProvider>;
}
