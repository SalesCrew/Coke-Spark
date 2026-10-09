"use client";

import { useSearchParams } from "next/navigation";
import { SmVisitWorkspace } from "@/components/sm/SmVisitWorkspace";
import { SmSMDurcharbeitVisitStart } from "@/components/sm/SmSMDurcharbeitVisitStart";
import { SMDurcharbeitVisitReference } from "@/lib/sm/SMDurcharbeitVisitReference";

export default function SmSMDurcharbeitBesuchPage() {
  const params = useSearchParams(), visitId = params.get("visitId")?.trim(), targetId = params.get("targetId")?.trim();
  if (visitId) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(visitId)) return <p role="alert" className="p-6 text-sm text-red-700">Ungültige Besuchskennung.</p>;
    return <SmVisitWorkspace assignmentId={SMDurcharbeitVisitReference(visitId)} resumeQuestionId={params.get("questionId")} />;
  }
  if (targetId) return <SmSMDurcharbeitVisitStart targetId={targetId} />;
  return <main className="flex min-h-screen items-center justify-center bg-[#f5f5f7] text-[12px] font-semibold text-gray-500">Kein Durcharbeit-Markt ausgewählt.</main>;
}
