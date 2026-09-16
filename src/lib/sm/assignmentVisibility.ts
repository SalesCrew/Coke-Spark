/** Employee visibility only. Admins must retain cancelled assignments and history. */
export function visibleSmAssignments<T extends { status: string }>(assignments: readonly T[]): T[] {
  return assignments.filter((assignment) => assignment.status !== "cancelled");
}
