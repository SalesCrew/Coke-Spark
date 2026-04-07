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
  startTime: string; // "HH:MM" — day start (Anfahrt begin)
  endTime: string;   // "HH:MM" — day end (Heimfahrt end)
  startKm: number;
  endKm: number;
  entries: TimeEntry[];
}
