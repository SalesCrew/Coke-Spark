import type { Workspace } from "@/types/praemien-workspace";

export const ALL_BONUS_GMS = "__all_bonus_gms__";
export function selectBonusResult(workspace: Workspace | null, selectedId: string | null) {
  const rows = workspace?.results ?? [];
  const gm = rows.find((row) => row.gmId === selectedId) ?? rows.find((row) => row.active) ?? rows[0];
  if (selectedId !== ALL_BONUS_GMS) return gm;
  if (!rows.length) return undefined;
  const pillars = new Map<string, (typeof rows)[number]["pillars"][number]>();
  for (const row of rows) for (const pillar of row.pillars) {
    const previous = pillars.get(pillar.key);
    pillars.set(pillar.key, previous ? {
      ...previous,
      earned: previous.earned + pillar.earned,
      maximum: previous.maximum + pillar.maximum,
      pending: previous.pending || pillar.pending,
    } : { ...pillar });
  }
  return {
    gmId: ALL_BONUS_GMS, name: "Alle", active: true, rank: 0,
    earned: rows.reduce((sum, row) => sum + row.earned, 0),
    maximum: rows.reduce((sum, row) => sum + row.maximum, 0),
    pending: rows.some((row) => row.pending), pillars: [...pillars.values()],
  };
}
