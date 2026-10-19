export type MileageSegment = { startKm: number; endKm: number };
export type MileageState = { segments: MileageSegment[]; breakBefore: boolean; breakAfter: boolean };
export type MileageDay = { id: string; workDate: string; status: string; startKm: number | null; endKm: number | null; mileage: MileageState | null };
export type MileageSnapshot = { startKm: number | null; endKm: number | null; mileage: MileageState | null };
export type MileageHistory = { id: string; operationId: string; reason: string; actor: string; createdAt: string; before: MileageSnapshot; after: MileageSnapshot };
export type MileageContext = { selected: MileageDay[]; days: MileageDay[]; fingerprint: string; history: MileageHistory[] };
export type MileageCorrection = { sessionId: string; from: string; to: string; edits: { id: string; segments: MileageSegment[] }[]; breakBefore: boolean; returnAfter: boolean; reason: string; fingerprint?: string; operationId?: string };
export type MileagePreview = { before: { businessKm: number; privateKm: number }; after: { businessKm: number; privateKm: number }; days: MileageDay[]; fingerprint: string };
