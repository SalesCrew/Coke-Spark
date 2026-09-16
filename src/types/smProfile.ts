export type SmProfilePayload = {
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    isActive: boolean;
  };
  week: { from: string; to: string };
  summary: {
    assignedMarketCount: number;
    assignmentCount: number;
    completedAssignmentCount: number;
    plannedMinutes: number;
    actualMinutes: number;
  };
};
