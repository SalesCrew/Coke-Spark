export type EntryKind = "marktbesuch" | "zusatzzeit" | "pause";
export type EntrySubtype =
  | "schulung"
  | "sonderaufgabe"
  | "arztbesuch"
  | "werkstatt"
  | "homeoffice"
  | "lager"
  | "hoteluebernachtung";

export interface TimeEntry {
  id: string;
  kind: EntryKind;
  subtype?: EntrySubtype;
  comment?: string;
  doctorConfirmation?: {
    isRequired: boolean;
    isUploaded: boolean;
    uploadedAt: string | null;
    fileName: string | null;
  };
  marketName?: string;
  marketAddress?: string;
  questionnaireType?: string;
  startTime: string; // "HH:MM"
  endTime: string;   // "HH:MM"
  durationMin: number;
}

export interface TimeDaySession {
  id: string;
  date: string;      // "YYYY-MM-DD"
  gmId: string;
  gmName: string;
  region: string;
  status?: "started" | "ended" | "submitted";
  isLive?: boolean;
  timezone?: string;
  startTime: string; // "HH:MM" — day start (Anfahrt begin)
  endTime: string;   // "HH:MM" — day end (Heimfahrt end)
  startKm: number | null;
  endKm: number | null;
  entries: TimeEntry[];
  timeline?: Array<{
    id: string;
    kind: "anfahrt" | "fahrtzeit" | "marktbesuch" | "pause" | "zusatzzeit" | "heimfahrt";
    start: string;
    end: string;
    durationMin: number;
    title: string;
    subtitle?: string;
    subtype?: string;
    comment?: string;
    doctorConfirmation?: {
      isRequired: boolean;
      isUploaded: boolean;
      uploadedAt: string | null;
      fileName: string | null;
    };
    questionnaireType?: string;
  }>;
  stats?: {
    arbeitstag: number;
    pauseMin: number;
    reineArbeitszeit: number;
    kmGefahren: number | null;
    marktbesuche: number;
    zusatz: number;
  };
}
