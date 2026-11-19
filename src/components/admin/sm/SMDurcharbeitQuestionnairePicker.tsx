"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AdminDropdown } from "@/components/admin/AdminFilterControls";
import { requestSMDurcharbeitCampaign } from "@/lib/api/backend";
import { subscribeToAuthSessionChanges } from "@/lib/auth/sessionRegistry";
import type { SMDurcharbeitCampaignOptions, SMDurcharbeitQuestionnaireOption } from "@/types/smSMDurcharbeitCampaign";

/** Refresh only the catalog, preserving unsaved campaign dates, roster and version choice. */
export function SMDurcharbeitQuestionnairePicker({ value, questionnaires, onChange, ariaLabel, disabled = false, releaseOnSave = false }: {
  value: string;
  questionnaires: SMDurcharbeitCampaignOptions["questionnaires"];
  onChange: (value: string) => void;
  ariaLabel: string;
  disabled?: boolean;
  releaseOnSave?: boolean;
}) {
  const [catalog, setCatalog] = useState(questionnaires);
  const [pinned, setPinned] = useState<SMDurcharbeitQuestionnaireOption | null>(null);
  const generation = useRef(0);
  const currentValue = useRef(value);
  currentValue.current = value;
  useEffect(() => { setCatalog(questionnaires); }, [questionnaires]);
  useEffect(() => {
    const unsubscribe = subscribeToAuthSessionChanges(() => { generation.current++; setCatalog([]); setPinned(null); });
    return () => { generation.current++; unsubscribe(); };
  }, []);
  const refresh = useCallback(async () => {
    const current = ++generation.current;
    const fresh = await requestSMDurcharbeitCampaign<SMDurcharbeitCampaignOptions>(`/options${value ? `?selectedVersionId=${encodeURIComponent(value)}` : ""}`);
    if (current !== generation.current || value !== currentValue.current) throw new Error("Die Auswahl hat sich geändert.");
    setCatalog(fresh.questionnaires);
    setPinned(fresh.selectedQuestionnaire ?? null);
  }, [value]);
  useEffect(() => {
    if (value && !questionnaires.some(row => row.id === value)) void refresh().catch(() => { /* Opening the menu offers a visible retry. */ });
  }, [value, questionnaires, refresh]);
  const choices = catalog.map(row => ({ value: row.id, label: row.name, description: `Version ${row.versionNumber}${row.templateStatus === "inactive" ? " · Inaktiv" : ""}` }));
  if (pinned?.id === value && !choices.some(row => row.value === value)) choices.unshift({ value, label: pinned.name, description: `Bisher zugewiesen · Version ${pinned.versionNumber}` });
  return <div>
    <AdminDropdown value={value} options={choices}
      onChange={onChange} onOpen={refresh} ariaLabel={ariaLabel} placeholder="Fragebogen wählen" searchable disabled={disabled} />
    <p className="mt-1.5 text-[10px] leading-relaxed text-gray-500">{releaseOnSave ? "Freigabe beim Speichern." : "Freigabe mit Veröffentlichung der Kampagne."} <a href="/admin/sm/durcharbeit" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Fragebögen verwalten ↗</a></p>
  </div>;
}
