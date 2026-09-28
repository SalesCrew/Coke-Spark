"use client";

import { useDurcharbeitModules } from "@/app/admin/adminContexts";
import { ScopedQuestionnaireCatalog } from "@/components/admin/ScopedQuestionnaireCatalog";

export default function DurcharbeitPage() {
  return (
    <ScopedQuestionnaireCatalog
      useScopeModules={useDurcharbeitModules}
      scope="durcharbeit"
      questionnaireLabel="die Durcharbeit"
      exportTitle="Durcharbeit Fragebogen"
      exportEventName="admin:durcharbeit:export"
    />
  );
}
