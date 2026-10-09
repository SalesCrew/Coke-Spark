import type { SMDurcharbeitTarget } from "@/types/smSMDurcharbeitCampaign";
import { SMDurcharbeitVisitReference, smVisitResumeHref } from "./SMDurcharbeitVisitReference";

export function SMDurcharbeitMonthLabel(month: string) {
  return new Intl.DateTimeFormat("de-AT", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}T12:00:00Z`));
}

export function SMDurcharbeitTargetProgress(targets: SMDurcharbeitTarget[]) {
  const required = targets.filter(target => target.eligibility === "required");
  return { required: required.length, completed: required.filter(target => target.completed).length };
}

/** Preserve the established start/resume/history boundaries when moving the list. */
export function SMDurcharbeitTargetAction(target: SMDurcharbeitTarget, currentMonth: string) {
  const ownHistory = target.latestVisitSmUserId === target.smUserId ? target.latestVisitId : null;
  const visitId = target.draftVisitId ?? (!target.available ? ownHistory : null);
  const label = target.draftVisitId ? target.available ? "Fortsetzen" : "Entwurf ansehen"
    : visitId ? "Ansehen"
      : target.available ? target.completed ? "Folgebesuch" : "Starten"
        : target.eligibility === "waived" ? "Ausgenommen"
          : target.month > currentMonth ? "Geplant"
            : target.month < currentMonth ? target.completed ? "Erledigt" : "Nicht erledigt"
              : target.campaignStatus === "paused" ? "Pausiert" : "Geschlossen";
  return {
    label,
    href: visitId ? smVisitResumeHref(SMDurcharbeitVisitReference(visitId))
      : target.available ? `/sm/durcharbeit-besuch?targetId=${encodeURIComponent(target.id)}` : null,
  };
}
