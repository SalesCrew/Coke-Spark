export interface RedMonthPeriod {
  id: string;
  redPeriodId: string | null;
  redMonthYearId: string | null;
  label: string;
  periodIndexFromAnchor: number;
  periodIndex: number;
  start: string;
  end: string;
  lookupEnd: string;
  year: number;
  status: "draft" | "active" | "locked";
  isCurrent: boolean;
  daysUntilEnd: number;
}

export interface RedMonthConfig {
  redMonthYearId: string | null;
  redYear: number | null;
  anchorStart: string;
  cycleWeeks: number[];
  periodCount: number;
  timezone: string;
  status: "draft" | "active" | "locked";
  updatedAt: string | null;
}

export interface RedMonthCurrentPayload {
  current: RedMonthPeriod;
  config: RedMonthConfig;
}

export interface RedMonthYear {
  id: string;
  redMonthYearId: string;
  redYear: number;
  anchorStart: string;
  cycleWeeks: number[];
  periodCount: number;
  timezone: string;
  status: "draft" | "active" | "locked";
  createdAt: string;
  updatedAt: string;
}
