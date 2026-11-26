export type TimeEntryPhotoTag = { id: string; label: string };
export type TimeEntryPhoto = { id: string; name: string; url: string | null; previewError?: string; tags: TimeEntryPhotoTag[]; uploadedAt: string; revision: number; local?: boolean };
export type TimeEntryPhotoCollection = { photos: TimeEntryPhoto[]; availableTags: TimeEntryPhotoTag[]; canEdit: boolean; entry: { id: string; status: string } };
