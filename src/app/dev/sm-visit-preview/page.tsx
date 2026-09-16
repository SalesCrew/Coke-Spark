"use client";

import { SmVisitTemporaryQuestionnaire } from "@/components/sm/SmVisitWorkspace";

export default function SmVisitPreviewPage() {
  if (process.env.NODE_ENV !== "development") return null;
  return <SmVisitTemporaryQuestionnaire
    assignmentId="00000000-0000-4000-8000-000000000099"
    marketName="Temporärer Testmarkt"
    marketInternalId="TEMP-001"
    address="Beispielstraße 1 · 1010 Wien"
    region="Ost"
    workDate="2026-08-24"
  />;
}
