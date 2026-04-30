export interface RedMonthPeriod {
  id: string;
  label: string;
  periodIndexFromAnchor: number;
  start: string;
  end: string;
  year: number;
  isCurrent: boolean;
  daysUntilEnd: number;
}

export interface RedMonthConfig {
  anchorStart: string;
  cycleWeeks: number[];
  timezone: string;
  updatedAt: string | null;
}

export interface RedMonthCurrentPayload {
  current: RedMonthPeriod;
  config: RedMonthConfig;
}
