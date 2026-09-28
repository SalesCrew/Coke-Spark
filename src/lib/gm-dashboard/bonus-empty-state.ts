export type BonusEmptyState = {
  status: string;
  title: string;
  description: string;
  loading?: boolean;
  retry?: boolean;
};

export function bonusEmptyState(input: {
  loading: boolean;
  ready: boolean | null;
  error: string | null;
  waveCount: number;
  waveSelected: boolean;
  workspaceLoaded: boolean;
  hasParticipant: boolean;
  goalCount: number;
}): BonusEmptyState | null {
  if (input.loading)
    return {
      status: "Wird geladen …",
      title: "Prämien werden geladen",
      description: "Die Bonuswerte werden für dich vorbereitet.",
      loading: true,
    };
  if (input.ready === false)
    return {
      status: "Nicht eingerichtet",
      title: "Prämien noch nicht eingerichtet",
      description:
        "Sobald die Prämienauswertung eingerichtet ist, erscheinen hier die Bonuswerte.",
    };
  if (input.error)
    return {
      status: "Nicht geladen",
      title: "Bonusdaten konnten nicht geladen werden",
      description: "Bitte versuche es noch einmal.",
      retry: true,
    };
  if (!input.waveCount)
    return {
      status: "Keine Prämienwelle",
      title: "Noch keine Prämienwelle",
      description:
        "Sobald eine Prämienwelle angelegt ist, kannst du sie hier auswählen.",
    };
  if (!input.waveSelected)
    return {
      status: "Welle wählen",
      title: "Prämienwelle auswählen",
      description: "Wähle oben eine Prämienwelle, um die Bonuswerte zu sehen.",
    };
  if (!input.workspaceLoaded)
    return {
      status: "Wird geladen …",
      title: "Prämien werden geladen",
      description: "Die Bonuswerte werden für dich vorbereitet.",
      loading: true,
    };
  if (!input.hasParticipant)
    return {
      status: "Keine Teilnehmer",
      title: "Noch keine Teilnehmer",
      description: "Dieser Prämienwelle sind noch keine GMs zugeordnet.",
    };
  if (input.goalCount > 0) return null;
  return {
    status: "Keine Bonusziele",
    title: "Noch keine Bonusziele",
    description:
      "Für diese Prämienwelle sind noch keine Bonusziele hinterlegt.",
  };
}
