"use client";

import { useSearchParams } from "next/navigation";
import { SmVisitWorkspace } from "@/components/sm/SmVisitWorkspace";

export default function SmMarktbesuchPage() {
  const searchParams = useSearchParams();
  const assignmentId = searchParams.get("assignmentId")?.trim() ?? "";
  const resumeQuestionId = searchParams.get("questionId")?.trim() || null;
  if (!assignmentId) return <main className="flex min-h-screen items-center justify-center bg-[#f5f5f7] text-[12px] font-semibold text-gray-500">Kein Einsatz ausgewählt.</main>;
  return <SmVisitWorkspace assignmentId={assignmentId} resumeQuestionId={resumeQuestionId} />;
}
