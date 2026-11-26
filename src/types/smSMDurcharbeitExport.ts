import type { SmManagementReport } from "./smManagement";

export type SMDurcharbeitExportSelection = {
  campaignIds: string[]; smUserIds: string[]; regions: string[]; chains: string[];
  status: "all" | "active" | "inactive"; from?: string; to?: string;
};
export type SMDurcharbeitExportOptions = {
  range: SMDurcharbeitExportPreview;
  campaigns: Array<{ id: string; name: string; status: string; from: string; to: string }>;
  people: Array<{ id: string; name: string }>; regions: string[]; chains: string[];
};
export type SMDurcharbeitExportPreview = { visits: number; markets: number; campaigns: number; from: string | null; to: string | null };
export type SMDurcharbeitPlanningReport = SmManagementReport & {
  selection: SMDurcharbeitExportSelection; summary: SMDurcharbeitExportPreview;
  visitMetadata: Array<{ submissionId: string; market: Record<string, string> }>;
};

export function SMDurcharbeitExportQuery(selection: SMDurcharbeitExportSelection): string {
  const query = new URLSearchParams();
  for (const key of ["campaignIds", "smUserIds", "regions", "chains"] as const) if (selection[key].length) query.set(key, JSON.stringify(selection[key]));
  if (selection.status !== "all") query.set("status", selection.status);
  if (selection.from) query.set("from", selection.from);
  if (selection.to) query.set("to", selection.to);
  return query.toString();
}
