import type { SmPlanningAssignment } from "@/types/smPlanning";

export const DEFAULT_SM_PLANNING_STATUS = "not_cancelled";

export function matchesSmPlanningStatus(row: SmPlanningAssignment, filter: string): boolean {
  if (filter === "all") return true;
  if (filter === DEFAULT_SM_PLANNING_STATUS) return row.status !== "cancelled";
  if (filter === "rescheduled") return row.status !== "cancelled" && Boolean(row.replacement.workDate);
  if (filter === "replaced") return row.status !== "cancelled" && Boolean(row.replacement.smUserId);
  return row.status === filter;
}

// Cancellation preserves the original minutes for history, not active capacity.
export function smPlanningMinutes(rows: SmPlanningAssignment[]): number {
  return rows.reduce((sum, row) => sum + (row.status === "cancelled" ? 0 : row.effective.plannedMinutes), 0);
}
