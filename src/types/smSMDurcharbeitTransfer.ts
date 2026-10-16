export type SMDurcharbeitTransferRow = {
  id: string; name: string; detail: string; smUserId: string | null; smName: string; unavailableReason?: string | null;
};
export type SMDurcharbeitTransferInput = {
  marketIds: string[]; sourceSmUserId?: string; SMDurcharbeitSmUserId: string; reason: string;
};
export type SMDurcharbeitTransferPreview = {
  previewToken: string; marketCount: number; changedMarketCount: number; changeCount: number; unchangedCount: number;
  protected: Array<{ name: string; month: string | null; reason: string }>; months: string[];
};
