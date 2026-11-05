export type BriefingPage = {
  pageNumber: number;
  title: string;
  description: string;
};
export type BriefingFile = {
  path: string;
  name: string;
  pageCount: number;
  byteSize: number;
  dimensions: { width: number; height: number }[];
};
export type BriefingPublication = {
  actionFrom?: string | null;
  actionUntil?: string | null;
  id: string;
  version: number;
  sourceDraftRevision: number;
  visibleFrom: string;
  visibleUntil: string | null;
  publishedAt: string;
};
export type BriefingDraft = {
  actionFrom?: string | null;
  actionUntil?: string | null;
  id: string;
  title: string;
  description: string;
  file: BriefingFile;
  pages: BriefingPage[];
  visibleFrom: string | null;
  visibleUntil: string | null;
  draftRevision: number;
  archivedAt: string | null;
  publications?: BriefingPublication[];
};
export type GmBriefing = {
  actionFrom?: string | null;
  actionUntil?: string | null;
  id: string;
  briefingId: string;
  version: number;
  title: string;
  description: string;
  pages: BriefingPage[];
  pageCount: number;
  visibleFrom: string;
  visibleUntil: string | null;
  seenPages: number[];
  readAt: string | null;
};
export type BriefingInbox = { items: GmBriefing[]; unreadCount: number };
