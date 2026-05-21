export type CampaignSection = "standard" | "flex" | "billa" | "kuehler" | "mhd";
export type CampaignStatus = "active" | "scheduled" | "inactive";
export type CampaignScheduleType = "always" | "scheduled";

export type CampaignHistoryEntry = {
  id: string;
  fromFragebogenId: string | null;
  toFragebogenId: string;
  changedAt: string;
};

export type CampaignMarketAssignmentInput = {
  marketId: string;
  gmUserId: string | null;
  gmNameRaw?: string;
  assignmentSlot?: number;
  visitTargetCount?: number;
};

export type CampaignMarketAssignment = {
  marketId: string;
  gmUserId: string | null;
  gmName: string | null;
  assignmentSlot: number;
  visitTargetCount: number;
  currentVisitsCount: number;
};

export type CampaignMarketOverlapConflict = {
  marketId: string;
  marketName: string;
  section: CampaignSection;
  existingCampaignId: string;
  existingCampaignName: string;
  existingScheduleType: CampaignScheduleType;
  existingStartDate: string | null;
  existingEndDate: string | null;
  existingPeriodLabel: string;
  existingGmUserId: string | null;
  existingGmName: string | null;
};

export type Campaign = {
  id: string;
  name: string;
  section: CampaignSection;
  currentFragebogenId: string | null;
  currentFragebogenName: string | null;
  status: CampaignStatus;
  scheduleType: CampaignScheduleType;
  startDate: string | null;
  endDate: string | null;
  marketIds: string[];
  assignments: CampaignMarketAssignment[];
  history: CampaignHistoryEntry[];
  createdAt: string;
  updatedAt: string;
};

export type CreateCampaignInput = {
  name: string;
  section: CampaignSection;
  status: CampaignStatus;
  scheduleType: CampaignScheduleType;
  startDate?: string;
  endDate?: string;
  currentFragebogenId?: string;
  marketIds?: string[];
  assignments?: CampaignMarketAssignmentInput[];
};

export type UpdateCampaignInput = Partial<
  Pick<CreateCampaignInput, "name" | "status" | "scheduleType" | "startDate" | "endDate">
> & {
  currentFragebogenId?: string | null;
};
