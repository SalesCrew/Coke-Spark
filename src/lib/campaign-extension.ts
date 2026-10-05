import type { Campaign } from "@/types/campaign";

export function campaignExtensionToday(now = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Vienna" }).format(now);
}

export function campaignExtensionMinimum(campaign: Pick<Campaign, "endDate" | "startDate">, today = campaignExtensionToday()) {
  if (!campaign.endDate) return today;
  const next = new Date(`${campaign.endDate}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return [next.toISOString().slice(0, 10), today, campaign.startDate ?? today].sort().at(-1)!;
}

export function formatCampaignEndDate(value: string | null) {
  return value ? value.split("-").reverse().join(".") : "Unbefristet";
}
