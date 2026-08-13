"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Archive,
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Copy,
  Download,
  ExternalLink,
  Filter,
  Grid3X3,
  ImageOff,
  Images,
  List,
  Loader2,
  Pencil,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import {
  fetchAdminPhotoFacets,
  fetchAdminPhotos,
  fetchAdminPhotoSignedUrls,
  fetchCampaigns,
  fetchPhotoTags,
  fetchRedMonthCalendar,
  readAuthSession,
  updateAdminPhotoTags,
  type AdminPhotoArchiveFacets,
  type AdminPhotoArchiveFilters,
  type AdminPhotoArchiveItem,
  type AdminPhotoSignedUrl,
  type AdminPhotoCampaignType,
} from "@/lib/api/backend";
import { exportFotoarchivImagesZip } from "@/lib/exports/analysisExports";
import { useAdminAccess } from "@/context/AdminAccessContext";
import type { Campaign } from "@/types/campaign";
import type { RedMonthPeriod } from "@/types/red-month";

const R = "#DC2626";
const SOFT_BORDER = "1px solid rgba(0,0,0,0.08)";
const PANEL_SHADOW = "0 1px 2px rgba(0,0,0,0.04), 0 12px 28px rgba(15,23,42,0.05)";
const BUTTON_SHADOW = "inset 0 1px 0.6px rgba(255,255,255,0.9), inset 0 -1px 0 rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.07)";
const ADMIN_FONT_STACK = "var(--font-inter), Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

const TYPE_META: Record<AdminPhotoCampaignType, { label: string; color: string; bg: string }> = {
  standard: { label: "Standard", color: "#DC2626", bg: "rgba(220,38,38,0.08)" },
  flex: { label: "Flex", color: "#65a30d", bg: "rgba(132,204,22,0.10)" },
  billa: { label: "Billa", color: "#0891B2", bg: "rgba(8,145,178,0.10)" },
  kuehler: { label: "Kühler", color: "#D97706", bg: "rgba(245,158,11,0.10)" },
  mhd: { label: "MHD", color: "#7C3AED", bg: "rgba(124,58,237,0.10)" },
  durcharbeit: { label: "Durcharbeit", color: "#2563EB", bg: "rgba(37,99,235,0.10)" },
};

type ViewMode = "grid" | "list";
type Filters = AdminPhotoArchiveFilters & { redMonthId?: string };
type PhotoSignedUrlState = Pick<AdminPhotoSignedUrl, "signedUrl" | "expiresAt">;
type ExportTimeframeMode = "all" | "week" | "redMonth";
type ExportSelection = {
  campaignId?: string;
  timeframeMode: ExportTimeframeMode;
  week?: string;
  redMonthId?: string;
  chains: string[];
  tagKeys: string[];
};
type ExportCampaignOption = AdminPhotoArchiveFacets["campaigns"][number] & {
  historical: boolean;
  startDate: string | null;
  endDate: string | null;
};

const EMPTY_FACETS: AdminPhotoArchiveFacets = {
  campaigns: [],
  gms: [],
  tags: [],
  regions: [],
  chains: [],
};

function compact(value: Filters): Filters {
  const next: Filters = {};
  for (const [key, raw] of Object.entries(value)) {
    if (raw == null) continue;
    const stringValue = typeof raw === "string" ? raw.trim() : raw;
    if (stringValue === "") continue;
    (next as Record<string, unknown>)[key] = stringValue;
  }
  return next;
}

function readFilters(params: URLSearchParams): Filters {
  const get = (key: string) => params.get(key)?.trim() || undefined;
  const page = Number(get("page") ?? "1");
  return compact({
    page: Number.isFinite(page) && page > 1 ? page : 1,
    pageSize: 30,
    search: get("search"),
    campaignId: get("campaignId"),
    campaignType: get("campaignType") as AdminPhotoCampaignType | undefined,
    dateFrom: get("dateFrom"),
    dateTo: get("dateTo"),
    week: get("week"),
    region: get("region"),
    city: get("city"),
    postalCode: get("postalCode"),
    chain: get("chain"),
    gmUserId: get("gmUserId"),
    tagId: get("tagId"),
    tagLabel: get("tagLabel"),
    questionId: get("questionId"),
    moduleId: get("moduleId"),
    redMonthId: get("redMonthId"),
  });
}

function filtersToParams(filters: Filters): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(compact(filters))) {
    if (key === "pageSize") continue;
    if (key === "page" && Number(value) <= 1) continue;
    params.set(key, String(value));
  }
  return params;
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("de-AT", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return `${d.toLocaleDateString("de-AT", { day: "2-digit", month: "2-digit", year: "2-digit" })} ${d.toLocaleTimeString("de-AT", { hour: "2-digit", minute: "2-digit" })}`;
}

function fmtBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return "-";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function marketDisplayName(photo: AdminPhotoArchiveItem): string {
  const name = photo.market.name.trim();
  if (name) return name;
  return [photo.market.address, `${photo.market.postalCode} ${photo.market.city}`.trim()].filter(Boolean).join(", ");
}

const PHOTO_EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  "image/avif": ".avif",
  "image/gif": ".gif",
  "image/heic": ".heic",
  "image/heif": ".heif",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/tiff": ".tiff",
  "image/webp": ".webp",
};

function photoFileExtension(photo: AdminPhotoArchiveItem): string {
  const pathFileName = photo.storagePath.split("/").pop() ?? "";
  const pathExtension = pathFileName.match(/\.[a-z0-9]{2,5}$/i)?.[0];
  if (pathExtension) return pathExtension.toLocaleLowerCase("en-US");
  return PHOTO_EXTENSION_BY_MIME_TYPE[photo.mimeType?.toLocaleLowerCase("en-US") ?? ""] ?? ".jpg";
}

function photoDownloadFileName(photo: AdminPhotoArchiveItem): string {
  const address = [photo.market.address, `${photo.market.postalCode} ${photo.market.city}`.trim()].filter(Boolean).join(", ");
  const masterNumber = photo.market.cokeMasterNumber || photo.market.kuehlerStammnr;
  const baseName = [masterNumber, marketDisplayName(photo), address]
    .filter(Boolean)
    .join(" - ")
    .replace(/[<>:\"/\\|?*\u0000-\u001f]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/[. ]+$/g, "")
    .trim();
  const extension = photoFileExtension(photo);
  return `${baseName.slice(0, 180).replace(/[. ]+$/g, "") || "Foto"}${extension}`;
}

function photoDownloadUrl(signedUrl: string, fileName: string): string {
  if (!signedUrl) return "";
  try {
    const url = new URL(signedUrl);
    url.searchParams.set("download", fileName);
    return url.toString();
  } catch {
    return signedUrl;
  }
}

function isSignedUrlFresh(entry: PhotoSignedUrlState | undefined): boolean {
  if (!entry) return false;
  const expiresAtMs = new Date(entry.expiresAt).getTime();
  return Number.isFinite(expiresAtMs) && expiresAtMs - Date.now() > 60_000;
}

function ymd(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addMonths(date: Date, delta: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

function sameDay(a: string | undefined, b: string): boolean {
  return Boolean(a && a === b);
}

function isBetween(day: string, from?: string, to?: string): boolean {
  if (!from || !to) return false;
  return day > from && day < to;
}

function recentWeeks(): Array<{ value: string; label: string }> {
  const result: Array<{ value: string; label: string }> = [];
  const cursor = new Date();
  for (let i = 0; i < 18; i += 1) {
    const d = new Date(cursor);
    d.setDate(cursor.getDate() - i * 7);
    const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const day = tmp.getUTCDay() || 7;
    tmp.setUTCDate(tmp.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((tmp.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    const value = `${tmp.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
    if (!result.some((entry) => entry.value === value)) result.push({ value, label: `KW ${weekNo} / ${tmp.getUTCFullYear()}` });
  }
  return result;
}

function startOfIsoWeek(date: Date): Date {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = result.getDay() || 7;
  result.setDate(result.getDate() - day + 1);
  result.setHours(12, 0, 0, 0);
  return result;
}

function isoWeekValue(date: Date): { value: string; week: number; year: number } {
  const utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const year = utc.getUTCFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const week = Math.ceil((((utc.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return { value: `${year}-W${String(week).padStart(2, "0")}`, week, year };
}

function exportWeekOptions(campaigns: Campaign[]): Array<{ value: string; label: string }> {
  const today = new Date();
  const candidates = campaigns
    .flatMap((campaign) => [campaign.startDate, campaign.endDate, campaign.createdAt])
    .filter((value): value is string => Boolean(value))
    .map((value) => new Date(`${value.slice(0, 10)}T12:00:00`))
    .filter((value) => Number.isFinite(value.getTime()));
  const minimum = candidates.length > 0
    ? new Date(Math.min(...candidates.map((value) => value.getTime())))
    : new Date(today.getFullYear() - 1, 0, 1, 12);
  const maximum = candidates.length > 0
    ? new Date(Math.max(today.getTime(), ...candidates.map((value) => value.getTime())))
    : today;
  const first = startOfIsoWeek(minimum);
  const cursor = startOfIsoWeek(maximum);
  const result: Array<{ value: string; label: string }> = [];

  for (let index = 0; index < 520 && cursor >= first; index += 1) {
    const end = new Date(cursor);
    end.setDate(end.getDate() + 6);
    const iso = isoWeekValue(cursor);
    result.push({
      value: iso.value,
      label: `KW ${iso.week} / ${iso.year} · ${fmtDate(ymd(cursor))} – ${fmtDate(ymd(end))}`,
    });
    cursor.setDate(cursor.getDate() - 7);
  }

  return result;
}

function activeFilterCount(filters: Filters): number {
  return [
    "campaignId",
    "campaignType",
    "dateFrom",
    "dateTo",
    "week",
    "region",
    "city",
    "postalCode",
    "chain",
    "gmUserId",
    "tagId",
    "tagLabel",
    "questionId",
    "moduleId",
  ].filter((key) => Boolean((filters as Record<string, unknown>)[key])).length;
}

function dedupePhotosById(items: AdminPhotoArchiveItem[]): AdminPhotoArchiveItem[] {
  const seen = new Set<string>();
  const result: AdminPhotoArchiveItem[] = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    result.push(item);
  }
  return result;
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value?: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 5, minWidth: 0 }}>
      <span style={{ fontSize: 9, fontWeight: 800, color: "rgba(0,0,0,0.36)", letterSpacing: "0.08em", textTransform: "uppercase" }}>{label}</span>
      <select
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value)}
        style={{
          height: 34,
          borderRadius: 8,
          border: SOFT_BORDER,
          background: "linear-gradient(to bottom, #fff, #fafafa)",
          color: "rgba(0,0,0,0.66)",
          fontSize: 11,
          fontWeight: 700,
          padding: "0 10px",
          outline: "none",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.95), 0 1px 4px rgba(0,0,0,0.04)",
        }}
      >
        {options.map((option) => (
          <option key={option.value || "all"} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

function DateRangeCalendar({
  dateFrom,
  dateTo,
  onChange,
}: {
  dateFrom?: string;
  dateTo?: string;
  onChange: (next: { dateFrom?: string; dateTo?: string }) => void;
}) {
  const [month, setMonth] = useState(() => (dateFrom ? new Date(`${dateFrom}T12:00:00`) : new Date()));
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const startOffset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = Array.from({ length: startOffset + daysInMonth }, (_, index) => index < startOffset ? null : index - startOffset + 1);

  return (
    <div style={{ width: 288, padding: 10, borderRadius: 14, background: "#fff", border: SOFT_BORDER, boxShadow: "0 18px 40px rgba(15,23,42,0.14)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <button type="button" onClick={() => setMonth(addMonths(month, -1))} style={iconButtonStyle}>
          <ChevronLeft size={14} />
        </button>
        <div style={{ fontSize: 12, fontWeight: 800, color: "#111827" }}>
          {month.toLocaleDateString("de-AT", { month: "long", year: "numeric" })}
        </div>
        <button type="button" onClick={() => setMonth(addMonths(month, 1))} style={iconButtonStyle}>
          <ChevronRight size={14} />
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 4 }}>
        {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((day) => (
          <div key={day} style={{ textAlign: "center", fontSize: 9, fontWeight: 800, color: "rgba(0,0,0,0.34)" }}>{day}</div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
        {cells.map((day, index) => {
          if (day == null) return <div key={`empty-${index}`} />;
          const value = ymd(new Date(month.getFullYear(), month.getMonth(), day));
          const selected = sameDay(dateFrom, value) || sameDay(dateTo, value);
          const ranged = isBetween(value, dateFrom, dateTo);
          return (
            <button
              key={value}
              type="button"
              onClick={() => {
                if (!dateFrom || (dateFrom && dateTo) || value < dateFrom) onChange({ dateFrom: value, dateTo: undefined });
                else onChange({ dateFrom, dateTo: value });
              }}
              style={{
                height: 30,
                borderRadius: 8,
                border: selected ? "1px solid rgba(220,38,38,0.45)" : "1px solid transparent",
                background: selected ? "rgba(220,38,38,0.10)" : ranged ? "rgba(220,38,38,0.045)" : "#fff",
                color: selected ? R : "rgba(0,0,0,0.72)",
                fontSize: 11,
                fontWeight: selected ? 800 : 700,
                cursor: "pointer",
              }}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const iconButtonStyle: React.CSSProperties = {
  width: 30,
  height: 30,
  borderRadius: 8,
  border: SOFT_BORDER,
  background: "linear-gradient(to bottom, #fff, #f7f7f7)",
  boxShadow: BUTTON_SHADOW,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  lineHeight: 0,
  cursor: "pointer",
  color: "rgba(0,0,0,0.55)",
};

const viewToggleButtonStyle: React.CSSProperties = {
  width: 34,
  height: 32,
  border: "none",
  display: "grid",
  placeItems: "center",
  padding: 0,
  lineHeight: 0,
  cursor: "pointer",
};

function FilterModal({
  open,
  filters,
  facets,
  redMonths,
  hideMhdCampaigns,
  onClose,
  onApply,
  onReset,
}: {
  open: boolean;
  filters: Filters;
  facets: AdminPhotoArchiveFacets;
  redMonths: RedMonthPeriod[];
  hideMhdCampaigns: boolean;
  onClose: () => void;
  onApply: (filters: Filters) => void;
  onReset: () => void;
}) {
  const [draft, setDraft] = useState<Filters>(filters);
  const [calendarOpen, setCalendarOpen] = useState(false);

  useEffect(() => {
    if (open) setDraft(filters);
  }, [filters, open]);

  if (!open) return null;

  const update = (patch: Filters) => setDraft((prev) => compact({ ...prev, ...patch, page: 1 }));
  const dateLabel = draft.dateFrom && draft.dateTo ? `${fmtDate(draft.dateFrom)} - ${fmtDate(draft.dateTo)}` : "Alle Zeiträume";

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 2000, background: "rgba(15,23,42,0.22)", backdropFilter: "blur(10px)", display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 96 }}>
      <div style={{ width: "min(920px, calc(100vw - 48px))", borderRadius: 18, background: "rgba(255,255,255,0.98)", border: "1px solid rgba(255,255,255,0.85)", boxShadow: "0 24px 70px rgba(15,23,42,0.24)", padding: 18, position: "relative" }}>
        <button type="button" onClick={onClose} style={{ ...iconButtonStyle, position: "absolute", top: 16, right: 16 }}>
          <X size={15} />
        </button>
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: "rgba(0,0,0,0.34)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Fotoarchiv filtern</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3 }}>
            <h2 style={{ margin: 0, fontSize: 19, lineHeight: 1, letterSpacing: "-0.03em", color: "#111827" }}>Bilder aus Foto-Fragen</h2>
            <span style={{ borderRadius: 999, border: SOFT_BORDER, padding: "3px 8px", fontSize: 10, fontWeight: 800, color: "rgba(0,0,0,0.42)", background: "#f7f7f8" }}>
              {activeFilterCount(draft)} aktiv
            </span>
          </div>
        </div>

        <div style={{ border: SOFT_BORDER, borderRadius: 14, padding: 14, background: "rgba(255,255,255,0.72)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(180px, 0.8fr) 1fr auto", gap: 10, alignItems: "end", marginBottom: 12 }}>
            <div style={{ position: "relative" }}>
              <span style={{ display: "block", fontSize: 9, fontWeight: 800, color: "rgba(0,0,0,0.36)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 5 }}>Zeitraum</span>
              <button type="button" onClick={() => setCalendarOpen((value) => !value)} style={{ height: 34, minWidth: 190, borderRadius: 8, border: SOFT_BORDER, background: "linear-gradient(to bottom, #fff, #fafafa)", boxShadow: BUTTON_SHADOW, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "0 10px", fontSize: 11, fontWeight: 800, color: "rgba(0,0,0,0.62)", cursor: "pointer" }}>
                <span>{dateLabel}</span>
                <Calendar size={13} />
              </button>
              {calendarOpen && (
                <div style={{ position: "absolute", top: 58, left: 0, zIndex: 5 }}>
                  <DateRangeCalendar
                    dateFrom={draft.dateFrom}
                    dateTo={draft.dateTo}
                    onChange={(range) => update({ ...range, week: undefined, redMonthId: undefined })}
                  />
                </div>
              )}
            </div>
            <SelectField
              label="Red Month"
              value={draft.redMonthId}
              onChange={(value) => {
                const period = redMonths.find((entry) => entry.id === value);
                update(value && period ? { redMonthId: value, dateFrom: period.start, dateTo: period.end, week: undefined } : { redMonthId: undefined, dateFrom: undefined, dateTo: undefined });
              }}
              options={[{ value: "", label: "Alle Red Months" }, ...redMonths.map((period) => ({ value: period.id, label: `${period.label} (${fmtDate(period.start)} - ${fmtDate(period.end)})` }))]}
            />
            <button type="button" onClick={() => { setDraft({ page: 1, pageSize: 30 }); onReset(); }} style={{ height: 34, borderRadius: 8, border: "1px solid rgba(220,38,38,0.14)", background: "rgba(220,38,38,0.07)", color: R, padding: "0 12px", fontSize: 11, fontWeight: 800, cursor: "pointer" }}>
              Alle Filter zurücksetzen
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.3fr 0.8fr 0.9fr", gap: 10, marginBottom: 10 }}>
            <SelectField label="Kampagne" value={draft.campaignId} onChange={(value) => update({ campaignId: value || undefined })} options={[{ value: "", label: "Alle Kampagnen" }, ...facets.campaigns.map((campaign) => ({ value: campaign.id, label: campaign.name }))]} />
            <SelectField label="Typ" value={draft.campaignType} onChange={(value) => update({ campaignType: value as AdminPhotoCampaignType || undefined })} options={[{ value: "", label: "Alle Typen" }, ...Object.entries(TYPE_META).filter(([value]) => !hideMhdCampaigns || value !== "mhd").map(([value, meta]) => ({ value, label: meta.label }))]} />
            <SelectField label="Kalenderwoche" value={draft.week} onChange={(value) => update({ week: value || undefined, dateFrom: undefined, dateTo: undefined, redMonthId: undefined })} options={[{ value: "", label: "Alle Wochen" }, ...recentWeeks()]} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10, marginBottom: 10 }}>
            <SelectField label="GM" value={draft.gmUserId} onChange={(value) => update({ gmUserId: value || undefined })} options={[{ value: "", label: "Alle GMs" }, ...facets.gms.map((gm) => ({ value: gm.id, label: gm.name }))]} />
            <SelectField label="Region" value={draft.region} onChange={(value) => update({ region: value || undefined })} options={[{ value: "", label: "Alle Regionen" }, ...facets.regions.map((region) => ({ value: region, label: region }))]} />
            <SelectField label="Chain" value={draft.chain} onChange={(value) => update({ chain: value || undefined })} options={[{ value: "", label: "Alle Chains" }, ...facets.chains.map((chain) => ({ value: chain, label: chain }))]} />
            <SelectField
              label="Foto-Tag"
              value={draft.tagId ? `id:${draft.tagId}` : draft.tagLabel ? `label:${draft.tagLabel}` : ""}
              onChange={(value) => {
                if (!value) update({ tagId: undefined, tagLabel: undefined });
                else if (value.startsWith("id:")) update({ tagId: value.slice(3), tagLabel: undefined });
                else update({ tagId: undefined, tagLabel: value.slice("label:".length) });
              }}
              options={[{ value: "", label: "Alle Tags" }, ...facets.tags.map((tag) => ({ value: tag.id ? `id:${tag.id}` : `label:${tag.label}`, label: tag.label }))]}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 0.45fr 0.6fr", gap: 10 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <span style={{ fontSize: 9, fontWeight: 800, color: "rgba(0,0,0,0.36)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Markt / Adresse / Frage</span>
              <input
                value={draft.search ?? ""}
                onChange={(event) => update({ search: event.target.value || undefined })}
                placeholder="Suchen..."
                style={{ height: 34, borderRadius: 8, border: SOFT_BORDER, background: "#fff", padding: "0 10px", fontSize: 11, fontWeight: 700, outline: "none", color: "rgba(0,0,0,0.68)" }}
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <span style={{ fontSize: 9, fontWeight: 800, color: "rgba(0,0,0,0.36)", letterSpacing: "0.08em", textTransform: "uppercase" }}>PLZ</span>
              <input value={draft.postalCode ?? ""} onChange={(event) => update({ postalCode: event.target.value || undefined })} placeholder="Alle" style={{ height: 34, borderRadius: 8, border: SOFT_BORDER, background: "#fff", padding: "0 10px", fontSize: 11, fontWeight: 700, outline: "none", color: "rgba(0,0,0,0.68)" }} />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <span style={{ fontSize: 9, fontWeight: 800, color: "rgba(0,0,0,0.36)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Ort</span>
              <input value={draft.city ?? ""} onChange={(event) => update({ city: event.target.value || undefined })} placeholder="Alle" style={{ height: 34, borderRadius: 8, border: SOFT_BORDER, background: "#fff", padding: "0 10px", fontSize: 11, fontWeight: 700, outline: "none", color: "rgba(0,0,0,0.68)" }} />
            </label>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 14 }}>
          <button type="button" onClick={onClose} style={{ height: 34, borderRadius: 8, border: "none", background: "linear-gradient(to bottom, #fff, #f5f5f5)", boxShadow: BUTTON_SHADOW, padding: "0 14px", fontSize: 11, fontWeight: 800, color: "rgba(0,0,0,0.62)", cursor: "pointer" }}>Schließen</button>
          <button type="button" onClick={() => { onApply(compact(draft)); onClose(); }} style={{ height: 34, borderRadius: 8, border: "none", background: "linear-gradient(to bottom, #DC2626, #b91c1c)", boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.33), inset 0 -1px 0 rgba(255,255,255,0.15), 0 0 0 1px #a91b1b, 0 1px 6px rgba(180,20,20,0.14)", padding: "0 16px", fontSize: 11, fontWeight: 800, color: "#fff", cursor: "pointer" }}>Filter anwenden</button>
        </div>
      </div>
    </div>
  );
}

function ExportDropdown({
  label,
  value,
  placeholder,
  options,
  onChange,
  searchable = false,
}: {
  label: string;
  value?: string;
  placeholder: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
  searchable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value);
  const visibleOptions = options.filter((option) => option.label.toLocaleLowerCase("de-AT").includes(search.trim().toLocaleLowerCase("de-AT")));

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div ref={rootRef} style={{ position: "relative", minWidth: 0 }}>
      <span style={{ display: "block", marginBottom: 6, fontSize: 9, fontWeight: 800, color: "rgba(15,23,42,0.38)", letterSpacing: "0.085em", textTransform: "uppercase" }}>{label}</span>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => { setOpen((current) => !current); setSearch(""); }}
        style={{ width: "100%", height: 38, borderRadius: 10, border: open ? "1px solid rgba(220,38,38,0.26)" : "1px solid rgba(15,23,42,0.09)", background: "linear-gradient(to bottom, #fff, #fafafa)", boxShadow: open ? "0 0 0 3px rgba(220,38,38,0.055), 0 2px 8px rgba(15,23,42,0.06)" : "0 1px 3px rgba(15,23,42,0.045)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "0 11px", color: selected ? "#111827" : "rgba(15,23,42,0.42)", fontFamily: "inherit", fontSize: 11, fontWeight: 700, cursor: "pointer", textAlign: "left" }}
      >
        <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selected?.label ?? placeholder}</span>
        <ChevronDown size={13} style={{ flexShrink: 0, transform: open ? "rotate(180deg)" : "none", transition: "transform 150ms ease" }} />
      </button>
      {open && (
        <div style={{ position: "absolute", top: 62, left: 0, right: 0, zIndex: 20, borderRadius: 12, border: "1px solid rgba(15,23,42,0.10)", background: "rgba(255,255,255,0.985)", boxShadow: "0 18px 44px rgba(15,23,42,0.16)", padding: 6, overflow: "hidden" }}>
          {searchable && (
            <label style={{ height: 34, marginBottom: 5, display: "flex", alignItems: "center", gap: 7, borderRadius: 8, border: "1px solid rgba(15,23,42,0.08)", background: "#f8fafc", padding: "0 9px" }}>
              <Search size={12} color="rgba(15,23,42,0.35)" />
              <input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Suchen..." style={{ width: "100%", border: 0, outline: 0, background: "transparent", fontFamily: "inherit", fontSize: 11, fontWeight: 600, color: "#111827" }} />
            </label>
          )}
          <div className="fotoExportScrollbar" style={{ maxHeight: 238, overflowY: "auto", paddingRight: 2 }}>
            {visibleOptions.length === 0 ? (
              <div style={{ padding: "16px 10px", textAlign: "center", fontSize: 11, fontWeight: 600, color: "rgba(15,23,42,0.42)" }}>Keine Auswahl gefunden</div>
            ) : visibleOptions.map((option) => {
              const active = option.value === value;
              return (
                <button key={option.value} type="button" onClick={() => { onChange(option.value); setOpen(false); }} style={{ width: "100%", minHeight: 34, border: 0, borderRadius: 8, background: active ? "rgba(220,38,38,0.07)" : "transparent", color: active ? R : "rgba(15,23,42,0.72)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "7px 9px", fontFamily: "inherit", fontSize: 10.5, lineHeight: 1.25, fontWeight: active ? 800 : 650, textAlign: "left", cursor: "pointer" }}>
                  <span>{option.label}</span>
                  {active && <Check size={12} strokeWidth={2.4} />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function ExportCampaignPicker({
  campaigns,
  value,
  onChange,
}: {
  campaigns: ExportCampaignOption[];
  value?: string;
  onChange: (value?: string) => void;
}) {
  const [search, setSearch] = useState("");
  const needle = search.trim().toLocaleLowerCase("de-AT");
  const matches = (campaign: ExportCampaignOption) => !needle || campaign.name.toLocaleLowerCase("de-AT").includes(needle);
  const current = campaigns.filter((campaign) => !campaign.historical && matches(campaign));
  const historical = campaigns.filter((campaign) => campaign.historical && matches(campaign));

  const campaignRow = (campaign: ExportCampaignOption) => {
    const selected = campaign.id === value;
    const meta = TYPE_META[campaign.type];
    return (
      <button key={campaign.id} type="button" onClick={() => onChange(campaign.id)} style={{ width: "100%", minHeight: 42, border: 0, borderLeft: selected ? `2px solid ${R}` : "2px solid transparent", borderRadius: 5, background: selected ? "rgba(220,38,38,0.045)" : "transparent", display: "grid", gridTemplateColumns: "18px minmax(0,1fr) 64px", alignItems: "center", gap: 8, padding: "6px 8px 6px 6px", color: selected ? R : "#111827", fontFamily: "inherit", textAlign: "left", cursor: "pointer" }}>
        <span style={{ width: 15, height: 15, borderRadius: 999, border: selected ? `4px solid ${R}` : "1.5px solid rgba(15,23,42,0.20)", background: "#fff", boxSizing: "border-box" }} />
        <span style={{ minWidth: 0 }}>
          <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 10.5, fontWeight: selected ? 800 : 700 }}>{campaign.name}</span>
          <span style={{ display: "block", marginTop: 2, fontSize: 8.5, fontWeight: 600, color: "rgba(15,23,42,0.38)" }}>{campaign.startDate && campaign.endDate ? `${fmtDate(campaign.startDate)} – ${fmtDate(campaign.endDate)}` : "Ohne festen Zeitraum"}</span>
        </span>
        <span style={{ width: 64, display: "inline-flex", alignItems: "center", justifyContent: "flex-end", gap: 5, color: meta.color, fontSize: 7.5, fontWeight: 850, textTransform: "uppercase", letterSpacing: "0.055em" }}>
          {meta.label}
          <span style={{ width: 3, height: 14, borderRadius: 2, background: meta.color, opacity: 0.72, flexShrink: 0 }} />
        </span>
      </button>
    );
  };

  return (
    <div style={{ borderRadius: 13, border: "1px solid rgba(15,23,42,0.08)", background: "rgba(248,250,252,0.68)", padding: 8 }}>
      <label style={{ height: 34, display: "flex", alignItems: "center", gap: 7, borderRadius: 9, border: "1px solid rgba(15,23,42,0.08)", background: "#fff", padding: "0 9px", boxShadow: "0 1px 2px rgba(15,23,42,0.03)" }}>
        <Search size={12} color="rgba(15,23,42,0.34)" />
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Kampagne suchen..." style={{ width: "100%", border: 0, outline: 0, background: "transparent", fontFamily: "inherit", fontSize: 10.5, fontWeight: 600, color: "#111827" }} />
      </label>
      <div className="fotoExportHiddenScrollbar" style={{ height: 286, marginTop: 7, overflowY: "auto", overscrollBehavior: "contain" }}>
        <button type="button" onClick={() => onChange(undefined)} style={{ width: "100%", minHeight: 40, border: 0, borderLeft: !value ? `2px solid ${R}` : "2px solid transparent", borderRadius: 5, background: !value ? "rgba(220,38,38,0.045)" : "transparent", display: "grid", gridTemplateColumns: "18px minmax(0,1fr) auto", alignItems: "center", gap: 8, padding: "6px 8px 6px 6px", color: !value ? R : "#111827", fontFamily: "inherit", textAlign: "left", cursor: "pointer" }}>
          <span style={{ width: 15, height: 15, borderRadius: 999, border: !value ? `4px solid ${R}` : "1.5px solid rgba(15,23,42,0.20)", background: "#fff", boxSizing: "border-box" }} />
          <span style={{ fontSize: 10.5, fontWeight: !value ? 800 : 700 }}>Alle Kampagnen</span>
          <span style={{ fontSize: 8.5, fontWeight: 700, color: "rgba(15,23,42,0.34)" }}>{campaigns.length}</span>
        </button>

        <div style={{ padding: "8px 8px 4px", fontSize: 8.5, fontWeight: 850, color: "rgba(15,23,42,0.34)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Aktiv & geplant · {current.length}</div>
        {current.map(campaignRow)}
        {current.length === 0 && <div style={{ padding: "9px", fontSize: 10, color: "rgba(15,23,42,0.40)" }}>Keine passenden aktuellen Kampagnen.</div>}

        <div style={{ marginTop: 5, padding: "9px 8px 4px", borderTop: "1px solid rgba(15,23,42,0.06)", fontSize: 8.5, fontWeight: 850, color: "rgba(15,23,42,0.34)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Historisch · {historical.length}</div>
        {historical.map(campaignRow)}
        {historical.length === 0 && <div style={{ padding: "9px", fontSize: 10, color: "rgba(15,23,42,0.40)" }}>Keine historischen Kampagnen gefunden.</div>}
      </div>
    </div>
  );
}

function ExportMultiPicker({
  label,
  allLabel,
  searchPlaceholder,
  emptyLabel,
  options,
  values,
  onChange,
}: {
  label: string;
  allLabel: string;
  searchPlaceholder: string;
  emptyLabel: string;
  options: Array<{ value: string; label: string }>;
  values: string[];
  onChange: (values: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const selectedValues = useMemo(() => new Set(values), [values]);
  const selectedOptions = options.filter((option) => selectedValues.has(option.value));
  const needle = search.trim().toLocaleLowerCase("de-AT");
  const visibleOptions = options.filter((option) => !needle || option.label.toLocaleLowerCase("de-AT").includes(needle));
  const selectionLabel = selectedOptions.length === 0
    ? allLabel
    : selectedOptions.length === 1
      ? selectedOptions[0]?.label ?? "1 ausgewählt"
      : `${selectedOptions.length} ausgewählt`;

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const toggle = (value: string) => {
    if (selectedValues.has(value)) onChange(values.filter((entry) => entry !== value));
    else onChange([...values, value]);
  };

  return (
    <div ref={rootRef} style={{ position: "relative", minWidth: 0 }}>
      <span style={{ display: "block", marginBottom: 6, fontSize: 9, fontWeight: 800, color: "rgba(15,23,42,0.38)", letterSpacing: "0.085em", textTransform: "uppercase" }}>{label}</span>
      <button type="button" aria-expanded={open} onClick={() => { setOpen((current) => !current); setSearch(""); }} style={{ width: "100%", height: 38, borderRadius: 10, border: open ? "1px solid rgba(220,38,38,0.26)" : "1px solid rgba(15,23,42,0.09)", background: "linear-gradient(to bottom, #fff, #fafafa)", boxShadow: open ? "0 0 0 3px rgba(220,38,38,0.055), 0 2px 8px rgba(15,23,42,0.06)" : "0 1px 3px rgba(15,23,42,0.045)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "0 11px", color: selectedOptions.length ? "#111827" : "rgba(15,23,42,0.42)", fontFamily: "inherit", fontSize: 11, fontWeight: 700, cursor: "pointer", textAlign: "left" }}>
        <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selectionLabel}</span>
        <ChevronDown size={13} style={{ flexShrink: 0, transform: open ? "rotate(180deg)" : "none", transition: "transform 150ms ease" }} />
      </button>
      {open && (
        <div style={{ position: "absolute", top: 62, left: 0, right: 0, zIndex: 30, borderRadius: 12, border: "1px solid rgba(15,23,42,0.10)", background: "rgba(255,255,255,0.985)", boxShadow: "0 18px 44px rgba(15,23,42,0.16)", padding: 6, overflow: "hidden" }}>
          <label style={{ height: 34, marginBottom: 5, display: "flex", alignItems: "center", gap: 7, borderRadius: 8, border: "1px solid rgba(15,23,42,0.08)", background: "#f8fafc", padding: "0 9px" }}>
            <Search size={12} color="rgba(15,23,42,0.35)" />
            <input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder={searchPlaceholder} style={{ width: "100%", border: 0, outline: 0, background: "transparent", fontFamily: "inherit", fontSize: 11, fontWeight: 600, color: "#111827" }} />
          </label>
          <button type="button" onClick={() => onChange([])} style={{ width: "100%", minHeight: 34, border: 0, borderRadius: 8, background: values.length === 0 ? "rgba(220,38,38,0.07)" : "transparent", color: values.length === 0 ? R : "rgba(15,23,42,0.72)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "7px 9px", fontFamily: "inherit", fontSize: 10.5, fontWeight: values.length === 0 ? 800 : 650, textAlign: "left", cursor: "pointer" }}>
            <span>{allLabel}</span>
            {values.length === 0 && <Check size={12} strokeWidth={2.4} />}
          </button>
          <div className="fotoExportScrollbar" style={{ maxHeight: 190, overflowY: "auto", paddingRight: 2 }}>
            {visibleOptions.length === 0 ? (
              <div style={{ padding: "16px 10px", textAlign: "center", fontSize: 11, fontWeight: 600, color: "rgba(15,23,42,0.42)" }}>{emptyLabel}</div>
            ) : visibleOptions.map((option) => {
              const active = selectedValues.has(option.value);
              return (
                <button key={option.value} type="button" onClick={() => toggle(option.value)} style={{ width: "100%", minHeight: 34, border: 0, borderRadius: 8, background: active ? "rgba(220,38,38,0.07)" : "transparent", color: active ? R : "rgba(15,23,42,0.72)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "7px 9px", fontFamily: "inherit", fontSize: 10.5, lineHeight: 1.25, fontWeight: active ? 800 : 650, textAlign: "left", cursor: "pointer" }}>
                  <span>{option.label}</span>
                  {active && <Check size={12} strokeWidth={2.4} />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function FotoExportModal({
  open,
  campaigns,
  photoCampaigns,
  chains,
  tags,
  redMonths,
  exporting,
  error,
  onClose,
  onExport,
}: {
  open: boolean;
  campaigns: Campaign[];
  photoCampaigns: AdminPhotoArchiveFacets["campaigns"];
  chains: AdminPhotoArchiveFacets["chains"];
  tags: AdminPhotoArchiveFacets["tags"];
  redMonths: RedMonthPeriod[];
  exporting: boolean;
  error: string | null;
  onClose: () => void;
  onExport: (filters: AdminPhotoArchiveFilters) => void;
}) {
  const [selection, setSelection] = useState<ExportSelection>({ timeframeMode: "all", chains: [], tagKeys: [] });
  const weekOptions = useMemo(() => exportWeekOptions(campaigns), [campaigns]);
  const campaignOptions = useMemo<ExportCampaignOption[]>(() => {
    const byId = new Map(campaigns.map((campaign) => [campaign.id, campaign]));
    const today = ymd(new Date());
    return photoCampaigns
      .map((campaign) => {
        const source = byId.get(campaign.id);
        const endDate = source?.endDate ?? null;
        return {
          ...campaign,
          historical: source?.status === "inactive" || Boolean(endDate && endDate < today),
          startDate: source?.startDate ?? null,
          endDate,
        };
      })
      .sort((a, b) => Number(a.historical) - Number(b.historical) || (b.endDate ?? "").localeCompare(a.endDate ?? "") || a.name.localeCompare(b.name, "de"));
  }, [campaigns, photoCampaigns]);
  const redMonthOptions = useMemo(() => redMonths
    .slice()
    .sort((a, b) => b.start.localeCompare(a.start))
    .map((period) => ({ value: period.id, label: `${period.label} · ${fmtDate(period.start)} – ${fmtDate(period.end)}` })), [redMonths]);
  const tagOptions = useMemo(() => {
    const byLabel = new Map<string, { value: string; label: string; hasId: boolean }>();
    for (const tag of tags) {
      const label = tag.label.trim();
      if (!label) continue;
      const key = label.toLocaleLowerCase("de-AT");
      const current = byLabel.get(key);
      if (!current || (!current.hasId && Boolean(tag.id))) {
        byLabel.set(key, { value: tag.id ? `id:${tag.id}` : `label:${label}`, label, hasId: Boolean(tag.id) });
      }
    }
    return Array.from(byLabel.values())
      .map(({ value, label }) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "de"));
  }, [tags]);
  const chainOptions = useMemo(() => Array.from(new Set(chains.map((chain) => chain.trim()).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b, "de"))
    .map((chain) => ({ value: chain, label: chain })), [chains]);

  useEffect(() => {
    if (open) setSelection({ timeframeMode: "all", chains: [], tagKeys: [] });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !exporting) onClose();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [exporting, onClose, open]);

  if (!open) return null;

  const selectMode = (mode: ExportTimeframeMode) => {
    if (mode === "week") {
      setSelection((current) => ({ ...current, timeframeMode: mode, week: current.week ?? weekOptions[0]?.value, redMonthId: undefined }));
      return;
    }
    if (mode === "redMonth") {
      const currentRedMonth = redMonths.find((period) => period.isCurrent)?.id ?? redMonthOptions[0]?.value;
      setSelection((current) => ({ ...current, timeframeMode: mode, redMonthId: current.redMonthId ?? currentRedMonth, week: undefined }));
      return;
    }
    setSelection((current) => ({ ...current, timeframeMode: mode, week: undefined, redMonthId: undefined }));
  };

  const selectionComplete = selection.timeframeMode === "all" || (selection.timeframeMode === "week" ? Boolean(selection.week) : Boolean(selection.redMonthId));
  const selectedCampaign = campaignOptions.find((campaign) => campaign.id === selection.campaignId);
  const selectedRedMonth = redMonths.find((period) => period.id === selection.redMonthId);
  const timeframeSummary = selection.timeframeMode === "week"
    ? weekOptions.find((option) => option.value === selection.week)?.label ?? "Kalenderwoche wählen"
    : selection.timeframeMode === "redMonth"
      ? redMonthOptions.find((option) => option.value === selection.redMonthId)?.label ?? "RED Month wählen"
      : "Gesamter Zeitraum";
  const tagSummary = selection.tagKeys.length === 0
    ? "Alle Tags"
    : selection.tagKeys.length === 1
      ? tagOptions.find((option) => option.value === selection.tagKeys[0])?.label ?? "1 Tag"
      : `${selection.tagKeys.length} Tags (mindestens einer)`;
  const chainSummary = selection.chains.length === 0
    ? "Alle Handelsketten"
    : selection.chains.length === 1
      ? selection.chains[0]
      : `${selection.chains.length} Handelsketten`;

  const submit = () => {
    if (!selectionComplete || exporting) return;
    const exportFilters: AdminPhotoArchiveFilters = {};
    if (selection.campaignId) exportFilters.campaignId = selection.campaignId;
    if (selection.timeframeMode === "week" && selection.week) exportFilters.week = selection.week;
    if (selection.timeframeMode === "redMonth" && selectedRedMonth) {
      exportFilters.dateFrom = selectedRedMonth.start;
      exportFilters.dateTo = selectedRedMonth.end;
    }
    if (selection.chains.length > 0) exportFilters.chains = selection.chains;
    const tagIds = selection.tagKeys.filter((key) => key.startsWith("id:")).map((key) => key.slice(3));
    const tagLabels = selection.tagKeys
      .map((key) => tagOptions.find((option) => option.value === key)?.label)
      .filter((label): label is string => Boolean(label));
    if (tagIds.length > 0) exportFilters.tagIds = tagIds;
    if (tagLabels.length > 0) exportFilters.tagLabels = tagLabels;
    onExport(exportFilters);
  };

  return (
    <div onMouseDown={(event) => { if (event.target === event.currentTarget && !exporting) onClose(); }} style={{ position: "fixed", inset: 0, zIndex: 2200, background: "rgba(15,23,42,0.25)", backdropFilter: "blur(11px)", display: "flex", alignItems: "flex-start", justifyContent: "center", overflowY: "auto", padding: "74px 24px 32px" }}>
      <div style={{ width: "min(900px, calc(100vw - 32px))", borderRadius: 19, border: "1px solid rgba(255,255,255,0.88)", background: "rgba(255,255,255,0.985)", boxShadow: "0 26px 80px rgba(15,23,42,0.25)", overflow: "visible", fontFamily: ADMIN_FONT_STACK }}>
        <div style={{ minHeight: 76, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "16px 18px", borderBottom: "1px solid rgba(15,23,42,0.065)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
            <div style={{ width: 38, height: 38, borderRadius: 11, display: "grid", placeItems: "center", color: R, background: "linear-gradient(145deg, rgba(220,38,38,0.105), rgba(220,38,38,0.035))", border: "1px solid rgba(220,38,38,0.13)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9)" }}><Archive size={17} strokeWidth={1.8} /></div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 8.5, fontWeight: 850, color: "rgba(15,23,42,0.36)", letterSpacing: "0.095em", textTransform: "uppercase" }}>Fotoexport vorbereiten</div>
              <h2 style={{ margin: "3px 0 0", fontSize: 18, lineHeight: 1.05, letterSpacing: "-0.03em", color: "#111827" }}>Fotos gezielt exportieren</h2>
            </div>
          </div>
          <button type="button" aria-label="Schließen" disabled={exporting} onClick={onClose} style={{ ...iconButtonStyle, opacity: exporting ? 0.45 : 1, cursor: exporting ? "default" : "pointer" }}><X size={14} /></button>
        </div>

        <div className="fotoExportGrid" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.08fr) minmax(300px, 0.92fr)", gap: 16, padding: 18 }}>
          <section style={{ minWidth: 0 }}>
            <div style={{ marginBottom: 9 }}>
              <div style={{ fontSize: 10.5, fontWeight: 800, color: "#111827" }}>Kampagne</div>
              <div style={{ marginTop: 3, fontSize: 9.5, lineHeight: 1.4, fontWeight: 550, color: "rgba(15,23,42,0.44)" }}>Aktuelle und historische Kampagnen gemeinsam durchsuchen und direkt auswählen.</div>
            </div>
            <ExportCampaignPicker campaigns={campaignOptions} value={selection.campaignId} onChange={(campaignId) => setSelection((current) => ({ ...current, campaignId }))} />
          </section>

          <section style={{ minWidth: 0 }}>
            <div style={{ marginBottom: 9 }}>
              <div style={{ fontSize: 10.5, fontWeight: 800, color: "#111827" }}>Zeitraum</div>
              <div style={{ marginTop: 3, fontSize: 9.5, lineHeight: 1.4, fontWeight: 550, color: "rgba(15,23,42,0.44)" }}>Nach Kalenderwoche oder nach dem hinterlegten RED-Month-Kalender filtern.</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", borderBottom: "1px solid rgba(15,23,42,0.09)" }}>
              {([
                ["all", "Alle"],
                ["week", "Woche"],
                ["redMonth", "RED Month"],
              ] as Array<[ExportTimeframeMode, string]>).map(([mode, label]) => {
                const active = selection.timeframeMode === mode;
                return <button key={mode} type="button" onClick={() => selectMode(mode)} style={{ height: 34, marginBottom: -1, border: 0, borderBottom: active ? `2px solid ${R}` : "2px solid transparent", background: "transparent", color: active ? R : "rgba(15,23,42,0.44)", fontFamily: "inherit", fontSize: 9.5, fontWeight: active ? 850 : 750, cursor: "pointer" }}>{label}</button>;
              })}
            </div>

            <div style={{ marginTop: 12 }}>
              {selection.timeframeMode === "week" && <ExportDropdown label="Kalenderwoche" value={selection.week} placeholder="Woche wählen" options={weekOptions} searchable onChange={(week) => setSelection((current) => ({ ...current, week }))} />}
              {selection.timeframeMode === "redMonth" && <ExportDropdown label="RED Month" value={selection.redMonthId} placeholder="RED Month wählen" options={redMonthOptions} searchable onChange={(redMonthId) => setSelection((current) => ({ ...current, redMonthId }))} />}
              {selection.timeframeMode === "all" && (
                <div style={{ minHeight: 76, borderRadius: 12, border: "1px dashed rgba(15,23,42,0.11)", background: "rgba(248,250,252,0.56)", display: "flex", alignItems: "center", gap: 10, padding: 12 }}>
                  <Clock3 size={16} color="rgba(15,23,42,0.34)" />
                  <div><div style={{ fontSize: 10.5, fontWeight: 750, color: "rgba(15,23,42,0.68)" }}>Kein Zeitfilter</div><div style={{ marginTop: 2, fontSize: 9, lineHeight: 1.35, fontWeight: 550, color: "rgba(15,23,42,0.40)" }}>Alle vorhandenen Fotos der Kampagnenauswahl werden berücksichtigt.</div></div>
                </div>
              )}
            </div>

            <div style={{ marginTop: 14 }}>
              <ExportMultiPicker label="Handelsketten" allLabel="Alle Handelsketten" searchPlaceholder="Handelskette suchen..." emptyLabel="Keine Handelsketten gefunden" options={chainOptions} values={selection.chains} onChange={(chains) => setSelection((current) => ({ ...current, chains }))} />
              <div style={{ marginTop: 5, fontSize: 8.8, lineHeight: 1.35, fontWeight: 550, color: "rgba(15,23,42,0.40)" }}>Bei mehreren Handelsketten werden Fotos aus mindestens einer ausgewählten Kette exportiert.</div>
            </div>

            <div style={{ marginTop: 14 }}>
              <ExportMultiPicker label="Foto-Tags" allLabel="Alle Tags" searchPlaceholder="Tag suchen..." emptyLabel="Keine Tags gefunden" options={tagOptions} values={selection.tagKeys} onChange={(tagKeys) => setSelection((current) => ({ ...current, tagKeys }))} />
              <div style={{ marginTop: 5, fontSize: 8.8, lineHeight: 1.35, fontWeight: 550, color: "rgba(15,23,42,0.40)" }}>Bei mehreren Tags werden Fotos mit mindestens einem ausgewählten Tag exportiert.</div>
            </div>

            <div style={{ marginTop: 16, borderRadius: 13, border: "1px solid rgba(220,38,38,0.10)", background: "linear-gradient(145deg, rgba(220,38,38,0.052), rgba(248,250,252,0.74))", padding: 13 }}>
              <div style={{ fontSize: 8.5, fontWeight: 850, color: "rgba(15,23,42,0.36)", letterSpacing: "0.085em", textTransform: "uppercase" }}>Exportauswahl</div>
              <div style={{ marginTop: 8, display: "grid", gap: 7 }}>
                <div style={{ display: "grid", gridTemplateColumns: "82px minmax(0,1fr)", gap: 8, fontSize: 10 }}><span style={{ fontWeight: 700, color: "rgba(15,23,42,0.40)" }}>Kampagne</span><span style={{ fontWeight: 800, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selectedCampaign?.name ?? "Alle Kampagnen"}</span></div>
                <div style={{ display: "grid", gridTemplateColumns: "82px minmax(0,1fr)", gap: 8, fontSize: 10 }}><span style={{ fontWeight: 700, color: "rgba(15,23,42,0.40)" }}>Zeitraum</span><span style={{ fontWeight: 800, color: "#111827", lineHeight: 1.35 }}>{timeframeSummary}</span></div>
                <div style={{ display: "grid", gridTemplateColumns: "82px minmax(0,1fr)", gap: 8, fontSize: 10 }}><span style={{ fontWeight: 700, color: "rgba(15,23,42,0.40)" }}>Ketten</span><span style={{ fontWeight: 800, color: "#111827", lineHeight: 1.35 }}>{chainSummary}</span></div>
                <div style={{ display: "grid", gridTemplateColumns: "82px minmax(0,1fr)", gap: 8, fontSize: 10 }}><span style={{ fontWeight: 700, color: "rgba(15,23,42,0.40)" }}>Tags</span><span style={{ fontWeight: 800, color: "#111827", lineHeight: 1.35 }}>{tagSummary}</span></div>
              </div>
            </div>
          </section>
        </div>

        {error && <div style={{ margin: "0 18px 12px", borderRadius: 10, border: "1px solid rgba(220,38,38,0.16)", background: "rgba(220,38,38,0.055)", color: R, padding: "9px 11px", fontSize: 10.5, lineHeight: 1.4, fontWeight: 750 }}>{error}</div>}
        <div style={{ minHeight: 64, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px 18px", borderTop: "1px solid rgba(15,23,42,0.065)", background: "rgba(248,250,252,0.58)", borderRadius: "0 0 19px 19px" }}>
          <div style={{ maxWidth: 430, fontSize: 9, lineHeight: 1.4, fontWeight: 550, color: "rgba(15,23,42,0.40)" }}>Der Download startet erst nach „Gefilterte Fotos exportieren“. Es werden ausschließlich Fotos dieser Auswahl geladen.</div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <button type="button" disabled={exporting} onClick={onClose} style={{ height: 35, borderRadius: 9, border: 0, background: "linear-gradient(to bottom, #fff, #f5f5f5)", boxShadow: BUTTON_SHADOW, padding: "0 13px", color: "rgba(15,23,42,0.60)", fontFamily: "inherit", fontSize: 10.5, fontWeight: 800, cursor: exporting ? "default" : "pointer", opacity: exporting ? 0.5 : 1 }}>Abbrechen</button>
            <button type="button" disabled={!selectionComplete || exporting} onClick={submit} style={{ height: 35, borderRadius: 9, border: 0, background: "linear-gradient(to bottom, #DC2626, #b91c1c)", boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.33), 0 0 0 1px #a91b1b, 0 4px 12px rgba(180,20,20,0.14)", display: "inline-flex", alignItems: "center", gap: 7, padding: "0 14px", color: "#fff", fontFamily: "inherit", fontSize: 10.5, fontWeight: 850, cursor: !selectionComplete || exporting ? "default" : "pointer", opacity: !selectionComplete || exporting ? 0.58 : 1 }}>
              {exporting ? <Loader2 size={13} className="photoArchiveSpin" /> : <Download size={13} />}
              {exporting ? "Export wird erstellt..." : "Gefilterte Fotos exportieren"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PhotoSkeleton() {
  return (
    <div style={{ borderRadius: 12, border: SOFT_BORDER, background: "#fff", boxShadow: PANEL_SHADOW, overflow: "hidden" }}>
      <div className="photoArchiveSkeleton" style={{ aspectRatio: "4/3" }} />
      <div style={{ padding: 12 }}>
        <div className="photoArchiveSkeleton" style={{ height: 12, width: "72%", borderRadius: 6, marginBottom: 8 }} />
        <div className="photoArchiveSkeleton" style={{ height: 9, width: "46%", borderRadius: 6 }} />
      </div>
    </div>
  );
}

function PhotoImage({
  photoId,
  src,
  onVisible,
  onError,
  imageStyle,
  iconSize = 24,
}: {
  photoId: string;
  src: string;
  onVisible: (photoId: string) => void;
  onError: () => void;
  imageStyle: React.CSSProperties;
  iconSize?: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || visible) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      onVisible(photoId);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setVisible(true);
        onVisible(photoId);
        observer.disconnect();
      },
      { rootMargin: "420px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [onVisible, photoId, visible]);

  return (
    <div ref={ref} style={{ width: "100%", height: "100%", position: "relative", overflow: "hidden" }}>
      {src ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          onError={onError}
          style={imageStyle}
        />
      ) : (
        <div className="photoArchiveSkeleton" style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <ImageOff size={iconSize} color="rgba(0,0,0,0.22)" />
        </div>
      )}
    </div>
  );
}

function PhotoTile({
  photo,
  onOpen,
  viewMode,
  previewUrl,
  originalUrl,
  onPreviewVisible,
  onPreviewError,
}: {
  photo: AdminPhotoArchiveItem;
  onOpen: () => void;
  viewMode: ViewMode;
  previewUrl?: PhotoSignedUrlState;
  originalUrl?: PhotoSignedUrlState;
  onPreviewVisible: (photoId: string) => void;
  onPreviewError: (photoId: string) => void;
}) {
  const [failed, setFailed] = useState(false);
  const [previewFailed, setPreviewFailed] = useState(false);
  const meta = TYPE_META[photo.campaign.type];
  const previewSrc = !previewFailed ? (previewUrl?.signedUrl ?? "") : "";
  const originalSrc = originalUrl?.signedUrl ?? "";
  const imageSrc = previewSrc || originalSrc;
  const imageSource = previewSrc ? "preview" : originalSrc ? "original" : "none";

  useEffect(() => {
    setFailed(false);
    setPreviewFailed(false);
  }, [photo.id]);

  const handleImageError = () => {
    if (imageSource === "preview") {
      setPreviewFailed(true);
      onPreviewError(photo.id);
      return;
    }
    setFailed(true);
  };

  if (viewMode === "list") {
    return (
      <button type="button" onClick={onOpen} style={{ width: "100%", minHeight: 78, display: "grid", gridTemplateColumns: "92px minmax(0,1fr) 180px 120px", gap: 12, alignItems: "center", border: "none", borderBottom: "1px solid rgba(0,0,0,0.05)", background: "#fff", padding: "10px 14px", cursor: "pointer", textAlign: "left" }}>
        <div style={{ width: 92, height: 58, borderRadius: 9, overflow: "hidden", background: "#f2f2f3", border: "1px solid rgba(0,0,0,0.06)" }}>
          {!failed ? (
            <PhotoImage
              photoId={photo.id}
              src={imageSrc}
              onVisible={onPreviewVisible}
              onError={handleImageError}
              iconSize={18}
              imageStyle={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
          ) : <ImageOff size={18} color="rgba(0,0,0,0.28)" style={{ margin: 20 }} />}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{marketDisplayName(photo)}</div>
          <div style={{ marginTop: 3, fontSize: 10, color: "rgba(0,0,0,0.45)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{photo.question.text}</div>
          <div style={{ marginTop: 5, display: "flex", gap: 5, flexWrap: "wrap" }}>{photo.tags.slice(0, 3).map((tag) => <span key={tag.id} style={tagStyle}>{tag.label}</span>)}</div>
        </div>
        <div style={{ minWidth: 0 }}>
          <span style={{ ...chipStyle, color: meta.color, background: meta.bg }}>{meta.label}</span>
          <div style={{ marginTop: 5, fontSize: 11, fontWeight: 600, color: "rgba(0,0,0,0.62)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{photo.campaign.name}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#111827" }}>{fmtDateTime(photo.visit.submittedAt)}</div>
          <div style={{ marginTop: 4, fontSize: 10, fontWeight: 600, color: "rgba(0,0,0,0.38)" }}>{photo.gm.name}</div>
        </div>
      </button>
    );
  }

  return (
    <button type="button" onClick={onOpen} style={{ border: SOFT_BORDER, background: "#fff", boxShadow: PANEL_SHADOW, borderRadius: 12, overflow: "hidden", padding: 0, cursor: "pointer", textAlign: "left", minWidth: 0 }}>
      <div style={{ position: "relative", aspectRatio: "4/3", background: "#f1f2f4", overflow: "hidden" }}>
        {!failed ? (
          <PhotoImage
            photoId={photo.id}
            src={imageSrc}
            onVisible={onPreviewVisible}
            onError={handleImageError}
            iconSize={30}
            imageStyle={{ width: "100%", height: "100%", objectFit: "cover", display: "block", transition: "transform 0.18s ease" }}
          />
        ) : (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(0,0,0,0.25)" }}>
            <ImageOff size={30} strokeWidth={1.5} />
          </div>
        )}
        <span style={{ ...chipStyle, position: "absolute", top: 9, left: 9, color: meta.color, background: "rgba(255,255,255,0.92)", border: `1px solid ${meta.color}33`, backdropFilter: "blur(8px)" }}>{meta.label}</span>
      </div>
      <div style={{ padding: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#111827", lineHeight: 1.15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{marketDisplayName(photo)}</div>
        <div style={{ marginTop: 5, fontSize: 10, color: "rgba(0,0,0,0.48)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{photo.campaign.name}</div>
        <div style={{ marginTop: 8, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: "rgba(0,0,0,0.42)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{photo.gm.name}</span>
          <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(0,0,0,0.54)", fontVariantNumeric: "tabular-nums" }}>{fmtDate(photo.visit.submittedAt)}</span>
        </div>
        {photo.tags.length > 0 && (
          <div style={{ marginTop: 9, display: "flex", gap: 5, flexWrap: "wrap" }}>
            {photo.tags.slice(0, 3).map((tag) => <span key={tag.id} style={tagStyle}>{tag.label}</span>)}
            {photo.tags.length > 3 && <span style={tagStyle}>+{photo.tags.length - 3}</span>}
          </div>
        )}
      </div>
    </button>
  );
}

const chipStyle: React.CSSProperties = {
  borderRadius: 999,
  padding: "3px 8px",
  fontSize: 9,
  fontWeight: 700,
  letterSpacing: "0.03em",
  textTransform: "uppercase",
};

const tagStyle: React.CSSProperties = {
  borderRadius: 999,
  padding: "2px 7px",
  fontSize: 9,
  fontWeight: 600,
  color: "rgba(0,0,0,0.55)",
  background: "rgba(0,0,0,0.045)",
  border: "1px solid rgba(0,0,0,0.06)",
};

function DetailDrawer({
  photo,
  loading,
  previewUrl,
  originalUrl,
  onOriginalNeeded,
  canEditTags,
  onTagsUpdated,
  onClose,
}: {
  photo: AdminPhotoArchiveItem | null;
  loading: boolean;
  previewUrl?: PhotoSignedUrlState;
  originalUrl?: PhotoSignedUrlState;
  onOriginalNeeded: (photoId: string) => void;
  canEditTags: boolean;
  onTagsUpdated: (photoId: string, tags: AdminPhotoArchiveItem["tags"]) => void;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [editingTags, setEditingTags] = useState(false);
  const [availableTags, setAvailableTags] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [tagSearch, setTagSearch] = useState("");
  const [tagsLoading, setTagsLoading] = useState(false);
  const [tagsSaving, setTagsSaving] = useState(false);
  const [tagError, setTagError] = useState<string | null>(null);
  const [imageZoom, setImageZoom] = useState(1);
  const [imageZoomOrigin, setImageZoomOrigin] = useState({ x: 50, y: 50 });
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const previewSrc = previewUrl?.signedUrl ?? "";
  const originalSrc = originalUrl?.signedUrl ?? "";
  const imageSrc = originalSrc || previewSrc;
  const meta = photo ? TYPE_META[photo.campaign.type] : TYPE_META.standard;
  const address = photo
    ? [photo.market.address, `${photo.market.postalCode} ${photo.market.city}`.trim()].filter(Boolean).join(", ")
    : "";
  const masterNumber = photo ? photo.market.cokeMasterNumber || photo.market.kuehlerStammnr : "";
  const downloadFileName = photo ? photoDownloadFileName(photo) : "";
  const downloadUrl = photoDownloadUrl(originalSrc, downloadFileName);

  useEffect(() => {
    if (photo && !originalSrc) onOriginalNeeded(photo.id);
  }, [onOriginalNeeded, originalSrc, photo]);

  useEffect(() => {
    setEditingTags(false);
    setAvailableTags([]);
    setSelectedTagIds([]);
    setTagSearch("");
    setTagError(null);
    setImageZoom(1);
    setImageZoomOrigin({ x: 50, y: 50 });
  }, [photo?.id]);

  useEffect(() => {
    const container = imageContainerRef.current;
    if (!container || !imageSrc) return;

    const handleWheelZoom = (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();

      const bounds = container.getBoundingClientRect();
      setImageZoomOrigin({
        x: Math.min(100, Math.max(0, ((event.clientX - bounds.left) / bounds.width) * 100)),
        y: Math.min(100, Math.max(0, ((event.clientY - bounds.top) / bounds.height) * 100)),
      });
      setImageZoom((current) => {
        const step = event.deltaY < 0 ? 0.2 : -0.2;
        return Math.min(5, Math.max(1, Number((current + step).toFixed(2))));
      });
    };

    container.addEventListener("wheel", handleWheelZoom, { passive: false });
    return () => container.removeEventListener("wheel", handleWheelZoom);
  }, [imageSrc]);

  const startTagEditing = useCallback(async () => {
    if (!photo || !canEditTags) return;
    setEditingTags(true);
    setTagsLoading(true);
    setTagError(null);
    setSelectedTagIds(photo.tags.map((tag) => tag.photoTagId).filter((id): id is string => Boolean(id)));
    try {
      const tags = await fetchPhotoTags();
      setAvailableTags(tags.map((tag) => ({ id: tag.id, label: tag.label })));
    } catch (error) {
      setTagError(error instanceof Error ? error.message : "Foto-Tags konnten nicht geladen werden.");
    } finally {
      setTagsLoading(false);
    }
  }, [canEditTags, photo]);

  const saveTags = useCallback(async () => {
    if (!photo || tagsSaving) return;
    setTagsSaving(true);
    setTagError(null);
    try {
      const tags = await updateAdminPhotoTags(photo.id, selectedTagIds);
      onTagsUpdated(photo.id, tags);
      setEditingTags(false);
    } catch (error) {
      setTagError(error instanceof Error ? error.message : "Foto-Tags konnten nicht gespeichert werden.");
    } finally {
      setTagsSaving(false);
    }
  }, [onTagsUpdated, photo, selectedTagIds, tagsSaving]);

  const visibleTags = availableTags.filter((tag) => tag.label.toLocaleLowerCase("de-AT").includes(tagSearch.trim().toLocaleLowerCase("de-AT")));

  if (!photo && !loading) return null;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1800, background: "rgba(15,23,42,0.20)", backdropFilter: "blur(8px)", display: "flex", justifyContent: "flex-end" }} onClick={onClose}>
      <aside onClick={(event) => event.stopPropagation()} style={{ width: "min(520px, calc(100vw - 28px))", height: "100%", background: "#fff", borderLeft: "1px solid rgba(0,0,0,0.08)", boxShadow: "-24px 0 60px rgba(15,23,42,0.16)", padding: 18, overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ minWidth: 0, paddingRight: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(0,0,0,0.34)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Fotodetail</div>
            <h2 style={{ margin: "3px 0 0", fontSize: 20, lineHeight: 1.15, letterSpacing: "-0.035em", color: "#111827", overflowWrap: "anywhere" }}>
              {photo ? [masterNumber, marketDisplayName(photo)].filter(Boolean).join(" · ") : "Foto wird geladen"}
            </h2>
            {photo && address ? (
              <div style={{ marginTop: 4, fontSize: 11, lineHeight: 1.35, fontWeight: 500, color: "rgba(17,24,39,0.56)", overflowWrap: "anywhere" }}>
                {address}
              </div>
            ) : null}
          </div>
          <button type="button" onClick={onClose} style={iconButtonStyle}><X size={15} /></button>
        </div>

        {loading || !photo ? (
          <div>
            <div className="photoArchiveSkeleton" style={{ height: 320, borderRadius: 14, marginBottom: 14 }} />
            <div className="photoArchiveSkeleton" style={{ height: 14, borderRadius: 8, width: "70%", marginBottom: 10 }} />
            <div className="photoArchiveSkeleton" style={{ height: 10, borderRadius: 8, width: "42%" }} />
          </div>
        ) : (
          <>
            <div
              ref={imageContainerRef}
              style={{ borderRadius: 16, overflow: "hidden", background: "#f1f2f4", border: SOFT_BORDER, minHeight: 280, position: "relative", cursor: imageSrc ? "crosshair" : "default" }}
            >
              {imageSrc ? (
                <img
                  src={imageSrc}
                  alt=""
                  decoding="async"
                  draggable={false}
                  style={{ width: "100%", maxHeight: 480, objectFit: "contain", display: "block", background: "#f6f6f7", filter: originalSrc ? "none" : "saturate(0.94)", opacity: originalSrc ? 1 : 0.88, transform: `scale(${imageZoom})`, transformOrigin: `${imageZoomOrigin.x}% ${imageZoomOrigin.y}%`, transition: "transform 90ms ease-out", willChange: imageZoom > 1 ? "transform" : "auto", userSelect: "none" }}
                />
              ) : <div className="photoArchiveSkeleton" style={{ height: 320, display: "flex", alignItems: "center", justifyContent: "center" }}><ImageOff size={38} color="rgba(0,0,0,0.25)" /></div>}
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <a href={downloadUrl || undefined} download={downloadFileName || undefined} style={{ textDecoration: "none" }}>
                <button type="button" disabled={!originalSrc} style={{ ...iconButtonStyle, width: "auto", padding: "0 12px", gap: 6, fontSize: 11, fontWeight: 700, opacity: originalSrc ? 1 : 0.55 }}>
                  <Download size={13} /> Download
                </button>
              </a>
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard?.writeText(address).then(() => {
                    setCopied(true);
                    window.setTimeout(() => setCopied(false), 1400);
                  });
                }}
                style={{ ...iconButtonStyle, width: "auto", padding: "0 12px", gap: 6, fontSize: 11, fontWeight: 700 }}
              >
                <Copy size={13} /> {copied ? "Kopiert" : "Adresse"}
              </button>
              <a href={`/admin/fbmanagement?campaignId=${encodeURIComponent(photo.campaign.id)}&marketId=${encodeURIComponent(photo.market.id)}&sessionId=${encodeURIComponent(photo.visitSessionId)}`} style={{ textDecoration: "none" }}>
                <button type="button" style={{ ...iconButtonStyle, width: "auto", padding: "0 12px", gap: 6, fontSize: 11, fontWeight: 700 }}>
                  <ExternalLink size={13} /> FB Management
                </button>
              </a>
            </div>

            <section style={{ marginTop: 18, border: SOFT_BORDER, borderRadius: 14, padding: 14, background: "#fff" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <span style={{ ...chipStyle, color: meta.color, background: meta.bg }}>{meta.label}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#111827" }}>{photo.campaign.name}</span>
              </div>
              <InfoGrid rows={[
                ["Markt", marketDisplayName(photo)],
                ["Stammnr.", masterNumber || "-"],
                ["Adresse", address],
                ["Region", photo.market.region || "-"],
                ["GM", photo.gm.name || "-"],
                ["Besuch", `${fmtDateTime(photo.visit.startedAt)} - ${fmtDateTime(photo.visit.submittedAt)}`],
                ["Dauer", photo.visit.durationMinutes == null ? "-" : `${photo.visit.durationMinutes} min`],
                ["Modul", photo.question.moduleName || "-"],
                ["Frage", photo.question.text || "-"],
              ]} />
            </section>

            <section style={{ marginTop: 10, border: SOFT_BORDER, borderRadius: 14, padding: 14, background: "#fff" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(0,0,0,0.36)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Datei</div>
                {canEditTags && !editingTags ? (
                  <button type="button" onClick={() => void startTagEditing()} style={{ ...iconButtonStyle, width: "auto", height: 28, padding: "0 9px", gap: 5, fontSize: 9, fontWeight: 700 }}>
                    <Pencil size={11} /> Tags bearbeiten
                  </button>
                ) : null}
              </div>
              <InfoGrid rows={[
                ["Typ", photo.mimeType || "-"],
                ["Gr??e", fmtBytes(photo.byteSize)],
                ["Abmessung", photo.widthPx && photo.heightPx ? `${photo.widthPx} x ${photo.heightPx}` : "-"],
                ["Upload", fmtDateTime(photo.uploadedAt)],
              ]} />
              {editingTags ? (
                <div style={{ marginTop: 13, borderTop: "1px solid rgba(15,23,42,0.06)", paddingTop: 12 }}>
                  <label style={{ height: 34, display: "flex", alignItems: "center", gap: 7, borderRadius: 9, border: "1px solid rgba(15,23,42,0.075)", background: "rgba(248,250,252,0.82)", padding: "0 10px" }}>
                    <Search size={12} color="rgba(15,23,42,0.34)" />
                    <input value={tagSearch} onChange={(event) => setTagSearch(event.target.value)} placeholder="Tag suchen..." style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent", fontFamily: "inherit", fontSize: 10, fontWeight: 600, color: "#111827" }} />
                  </label>
                  <div style={{ marginTop: 9, minHeight: 54, maxHeight: 190, overflowY: "auto", display: "flex", alignContent: "flex-start", flexWrap: "wrap", gap: 6 }}>
                    {tagsLoading ? (
                      <div style={{ width: "100%", minHeight: 54, display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(15,23,42,0.36)" }}><Loader2 size={15} className="animate-spin" /></div>
                    ) : visibleTags.length > 0 ? visibleTags.map((tag) => {
                      const selected = selectedTagIds.includes(tag.id);
                      return (
                        <button
                          key={tag.id}
                          type="button"
                          onClick={() => setSelectedTagIds((current) => selected ? current.filter((id) => id !== tag.id) : [...current, tag.id])}
                          style={{ minHeight: 28, borderRadius: 999, border: selected ? "1px solid rgba(220,38,38,0.22)" : "1px solid rgba(15,23,42,0.07)", background: selected ? "rgba(220,38,38,0.075)" : "#fff", color: selected ? R : "rgba(15,23,42,0.58)", padding: "0 9px", display: "inline-flex", alignItems: "center", gap: 5, fontFamily: "inherit", fontSize: 9, fontWeight: 700, cursor: "pointer" }}
                        >
                          {selected ? <Check size={10} strokeWidth={2.4} /> : null}{tag.label}
                        </button>
                      );
                    }) : (
                      <div style={{ width: "100%", padding: "15px 0", textAlign: "center", fontSize: 10, fontWeight: 600, color: "rgba(15,23,42,0.34)" }}>Kein Tag gefunden.</div>
                    )}
                  </div>
                  {tagError ? <div style={{ marginTop: 8, borderRadius: 8, border: "1px solid rgba(220,38,38,0.14)", background: "rgba(220,38,38,0.05)", padding: "8px 9px", fontSize: 9, fontWeight: 700, color: R }}>{tagError}</div> : null}
                  <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end", gap: 7 }}>
                    <button type="button" disabled={tagsSaving} onClick={() => { setEditingTags(false); setTagError(null); }} style={{ height: 30, borderRadius: 8, border: "none", background: "linear-gradient(to bottom, #fff, #f5f5f5)", boxShadow: BUTTON_SHADOW, padding: "0 11px", fontFamily: "inherit", fontSize: 9, fontWeight: 700, color: "rgba(15,23,42,0.52)", cursor: "pointer" }}>Abbrechen</button>
                    <button type="button" disabled={tagsLoading || tagsSaving} onClick={() => void saveTags()} style={{ height: 30, borderRadius: 8, border: "none", background: "linear-gradient(to bottom, #DC2626, #b91c1c)", boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.33), inset 0 -1px 0 rgba(255,255,255,0.15), 0 0 0 1px #a91b1b, 0 1px 6px rgba(180,20,20,0.14)", padding: "0 12px", display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "inherit", fontSize: 9, fontWeight: 750, color: "#fff", cursor: tagsSaving ? "wait" : "pointer", opacity: tagsLoading ? 0.55 : 1 }}>
                      {tagsSaving ? <Loader2 size={11} className="animate-spin" /> : null} Speichern
                    </button>
                  </div>
                </div>
              ) : photo.tags.length > 0 ? (
                <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 6 }}>{photo.tags.map((tag) => <span key={tag.id} style={tagStyle}>{tag.label}</span>)}</div>
              ) : (
                <div style={{ marginTop: 12, fontSize: 9, fontWeight: 600, color: "rgba(15,23,42,0.32)" }}>Keine Tags zugeordnet.</div>
              )}
              {photo.comment.trim() && <p style={{ margin: "12px 0 0", fontSize: 11, lineHeight: 1.5, fontWeight: 500, color: "rgba(0,0,0,0.58)" }}>{photo.comment}</p>}
            </section>
          </>
        )}
      </aside>
    </div>
  );
}

function InfoGrid({ rows }: { rows: Array<[string, string]> }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "108px minmax(0,1fr)", gap: "8px 12px" }}>
      {rows.map(([label, value]) => (
        <React.Fragment key={label}>
          <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(0,0,0,0.34)", letterSpacing: "0.07em", textTransform: "uppercase" }}>{label}</div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(0,0,0,0.72)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{value}</div>
        </React.Fragment>
      ))}
    </div>
  );
}

export default function FotoarchivPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isKunde } = useAdminAccess();
  const [filters, setFilters] = useState<Filters>(() => readFilters(new URLSearchParams(searchParams.toString())));
  const [searchDraft, setSearchDraft] = useState(filters.search ?? "");
  const [photos, setPhotos] = useState<AdminPhotoArchiveItem[]>([]);
  const [facets, setFacets] = useState<AdminPhotoArchiveFacets>(EMPTY_FACETS);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState({ visitedMarkets: 0, campaigns: 0 });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [redMonths, setRedMonths] = useState<RedMonthPeriod[]>([]);
  const [campaignCatalog, setCampaignCatalog] = useState<Campaign[]>([]);
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<AdminPhotoArchiveItem | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [previewUrls, setPreviewUrls] = useState<Record<string, PhotoSignedUrlState>>({});
  const [originalUrls, setOriginalUrls] = useState<Record<string, PhotoSignedUrlState>>({});
  const previewUrlsRef = useRef<Record<string, PhotoSignedUrlState>>({});
  const originalUrlsRef = useRef<Record<string, PhotoSignedUrlState>>({});
  const pendingPreviewIdsRef = useRef<Set<string>>(new Set());
  const requestedPreviewIdsRef = useRef<Set<string>>(new Set());
  const requestedOriginalIdsRef = useRef<Set<string>>(new Set());
  const previewQueueTimerRef = useRef<number | null>(null);

  useEffect(() => {
    previewUrlsRef.current = previewUrls;
  }, [previewUrls]);

  useEffect(() => {
    originalUrlsRef.current = originalUrls;
  }, [originalUrls]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setFilters((prev) => compact({ ...prev, search: searchDraft || undefined, page: 1 }));
    }, 260);
    return () => window.clearTimeout(handle);
  }, [searchDraft]);

  useEffect(() => {
    if (!isKunde || filters.campaignType !== "mhd") return;
    setFilters((current) => compact({ ...current, campaignType: undefined, page: 1 }));
  }, [filters.campaignType, isKunde]);

  useEffect(() => {
    let cancelled = false;
    void fetchCampaigns()
      .catch(() => [] as Campaign[])
      .then(async (nextCampaigns) => {
        if (!cancelled) setCampaignCatalog(nextCampaigns);
        const now = new Date();
        const years = nextCampaigns
          .flatMap((campaign) => [campaign.startDate, campaign.endDate, campaign.createdAt])
          .filter((value): value is string => Boolean(value))
          .map((value) => Number(value.slice(0, 4)))
          .filter((value) => Number.isFinite(value));
        const earliestYear = Math.max(2000, Math.min(now.getFullYear() - 1, ...years));
        const latestYear = Math.max(now.getFullYear() + 1, ...years);
        return fetchRedMonthCalendar({ from: `${earliestYear}-01-01`, to: `${latestYear}-12-31` });
      })
      .then((periods) => {
        if (!cancelled) setRedMonths(periods);
      })
      .catch(() => {
        if (!cancelled) setRedMonths([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchAdminPhotoFacets()
      .then((nextFacets) => {
        if (!cancelled) setFacets(nextFacets);
      })
      .catch(() => {
        if (!cancelled) setFacets(EMPTY_FACETS);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const requestOriginalUrls = useCallback((photoIds: string[]) => {
    const ids = Array.from(new Set(photoIds))
      .filter((photoId) => photoId && !isSignedUrlFresh(originalUrlsRef.current[photoId]) && !requestedOriginalIdsRef.current.has(photoId))
      .slice(0, 40);
    if (ids.length === 0) return;
    ids.forEach((photoId) => requestedOriginalIdsRef.current.add(photoId));
    fetchAdminPhotoSignedUrls(ids, "original")
      .then((urls) => {
        setOriginalUrls((prev) => {
          const next = { ...prev };
          for (const url of urls) {
            next[url.photoId] = { signedUrl: url.signedUrl, expiresAt: url.expiresAt };
          }
          return next;
        });
      })
      .catch(() => {})
      .finally(() => {
        ids.forEach((photoId) => requestedOriginalIdsRef.current.delete(photoId));
      });
  }, []);

  const flushPreviewQueue = useCallback(() => {
    previewQueueTimerRef.current = null;
    const ids = Array.from(pendingPreviewIdsRef.current).slice(0, 20);
    ids.forEach((photoId) => pendingPreviewIdsRef.current.delete(photoId));
    if (ids.length === 0) return;
    fetchAdminPhotoSignedUrls(ids, "preview")
      .then((urls) => {
        const fallbackOriginalIds: string[] = [];
        setPreviewUrls((prev) => {
          const next = { ...prev };
          for (const url of urls) {
            next[url.photoId] = { signedUrl: url.signedUrl, expiresAt: url.expiresAt };
            if (!url.signedUrl) fallbackOriginalIds.push(url.photoId);
          }
          return next;
        });
        if (fallbackOriginalIds.length > 0) requestOriginalUrls(fallbackOriginalIds);
      })
      .catch(() => requestOriginalUrls(ids))
      .finally(() => {
        ids.forEach((photoId) => requestedPreviewIdsRef.current.delete(photoId));
        if (pendingPreviewIdsRef.current.size > 0 && !previewQueueTimerRef.current) {
          previewQueueTimerRef.current = window.setTimeout(flushPreviewQueue, 80);
        }
      });
  }, [requestOriginalUrls]);

  const requestPreviewUrl = useCallback((photoId: string) => {
    if (!photoId || isSignedUrlFresh(previewUrlsRef.current[photoId]) || requestedPreviewIdsRef.current.has(photoId)) return;
    requestedPreviewIdsRef.current.add(photoId);
    pendingPreviewIdsRef.current.add(photoId);
    if (!previewQueueTimerRef.current) {
      previewQueueTimerRef.current = window.setTimeout(flushPreviewQueue, 80);
    }
  }, [flushPreviewQueue]);

  useEffect(() => {
    return () => {
      if (previewQueueTimerRef.current) window.clearTimeout(previewQueueTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const params = filtersToParams(filters);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [filters, pathname, router]);

  useEffect(() => {
    let cancelled = false;
    const page = filters.page ?? 1;
    setError(null);
    if (page > 1) setLoadingMore(true);
    else setLoading(true);

    fetchAdminPhotos({ ...filters, pageSize: 30 })
      .then((data) => {
        if (cancelled) return;
        setPhotos((prev) => page > 1 ? dedupePhotosById([...prev, ...data.photos]) : dedupePhotosById(data.photos));
        if (data.facets) setFacets(data.facets);
        setTotal(data.total);
        setStats(data.stats ?? { visitedMarkets: 0, campaigns: 0 });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Fotoarchiv konnte nicht geladen werden.");
        if (page <= 1) setPhotos([]);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
        setLoadingMore(false);
      });

    return () => {
      cancelled = true;
    };
  }, [filters]);

  useEffect(() => {
    if (!selectedPhotoId) {
      setSelectedPhoto(null);
      return;
    }
    const cached = photos.find((photo) => photo.id === selectedPhotoId) ?? null;
    setSelectedPhoto(cached);
    setDetailLoading(false);
    requestOriginalUrls([selectedPhotoId]);
  }, [photos, requestOriginalUrls, selectedPhotoId]);

  const hasMore = photos.length < total;
  const filterCount = activeFilterCount(filters);
  const timeframeLabel = filters.dateFrom && filters.dateTo ? `${fmtDate(filters.dateFrom)} - ${fmtDate(filters.dateTo)}` : "Alle Daten";

  const applyFilters = useCallback((next: Filters) => {
    setSearchDraft(next.search ?? "");
    setFilters(compact({ ...next, page: 1, pageSize: 30 }));
  }, []);

  const handlePhotoTagsUpdated = useCallback((photoId: string, tags: AdminPhotoArchiveItem["tags"]) => {
    setPhotos((current) => current.map((photo) => photo.id === photoId ? { ...photo, tags } : photo));
    setSelectedPhoto((current) => current?.id === photoId ? { ...current, tags } : current);
    void fetchAdminPhotoFacets().then(setFacets).catch(() => {});
  }, []);

  const handleExport = useCallback(async (exportFilters: AdminPhotoArchiveFilters) => {
    if (isExporting) return;
    setIsExporting(true);
    setExportError(null);
    try {
      const result = await exportFotoarchivImagesZip({ filters: exportFilters });
      if (result.downloaded) setExportOpen(false);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Fotoarchiv-Export konnte nicht erstellt werden.");
    } finally {
      setIsExporting(false);
    }
  }, [isExporting]);

  useEffect(() => {
    const handler = () => {
      setExportError(null);
      setExportOpen(true);
    };
    window.addEventListener("admin:fotoarchiv:export", handler);
    return () => window.removeEventListener("admin:fotoarchiv:export", handler);
  }, []);

  return (
    <main style={{ minHeight: "calc(100vh - 80px)", padding: 18, background: "#f5f5f7", fontFamily: ADMIN_FONT_STACK }}>
      <style>{`
        @keyframes photoArchiveShimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }
        @keyframes photoArchiveSpin { to { transform: rotate(360deg); } }
        .photoArchiveSkeleton {
          background: linear-gradient(90deg, rgba(0,0,0,0.045), rgba(255,255,255,0.95), rgba(0,0,0,0.045));
          background-size: 220% 100%;
          animation: photoArchiveShimmer 1.15s ease-in-out infinite;
        }
        .photoArchiveSpin { animation: photoArchiveSpin 0.8s linear infinite; }
        .fotoExportScrollbar { scrollbar-width: thin; scrollbar-color: rgba(15,23,42,0.16) transparent; }
        .fotoExportScrollbar::-webkit-scrollbar { width: 5px; }
        .fotoExportScrollbar::-webkit-scrollbar-track { background: transparent; }
        .fotoExportScrollbar::-webkit-scrollbar-thumb { background: rgba(15,23,42,0.14); border-radius: 999px; }
        .fotoExportHiddenScrollbar { scrollbar-width: none; -ms-overflow-style: none; }
        .fotoExportHiddenScrollbar::-webkit-scrollbar { display: none; width: 0; height: 0; }
        @media (max-width: 760px) {
          .fotoExportGrid { grid-template-columns: minmax(0, 1fr) !important; }
        }
      `}</style>

      <section
        style={{
          borderRadius: 14,
          border: "1px solid rgba(15,23,42,0.075)",
          background: "rgba(255,255,255,0.88)",
          boxShadow: "0 1px 2px rgba(15,23,42,0.035), 0 16px 36px rgba(15,23,42,0.045)",
          padding: "14px 16px",
          marginBottom: 12,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 18, flexWrap: "wrap" }}>
          <div style={{ minWidth: 320 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 9,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: R,
                  background: "linear-gradient(to bottom, rgba(220,38,38,0.075), rgba(220,38,38,0.035))",
                  border: "1px solid rgba(220,38,38,0.12)",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9)",
                  flexShrink: 0,
                }}
              >
                <Images size={15} strokeWidth={1.8} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(15,23,42,0.38)", letterSpacing: "0.09em", textTransform: "uppercase" }}>Fotoarchiv</div>
                <h1 style={{ margin: "2px 0 0", fontSize: 19, letterSpacing: "-0.035em", lineHeight: 1.04, color: "#111827" }}>Bilder aus Foto-Fragen</h1>
              </div>
            </div>
            <div style={{ marginTop: 13, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", color: "rgba(15,23,42,0.72)" }}>
              <Stat label="Fotos" value={loading ? "..." : total.toLocaleString("de-AT")} />
              <Stat label="Märkte" value={loading ? "..." : stats.visitedMarkets.toLocaleString("de-AT")} />
              <Stat label="Kampagnen" value={loading ? "..." : stats.campaigns.toLocaleString("de-AT")} />
              <Stat label="Zeitraum" value={timeframeLabel} />
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: 6,
              alignItems: "center",
              flexWrap: "wrap",
              justifyContent: "flex-end",
              padding: 4,
              borderRadius: 12,
              border: "1px solid rgba(15,23,42,0.07)",
              background: "rgba(248,250,252,0.82)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.86)",
            }}
          >
            <label
              style={{
                width: 320,
                height: 32,
                display: "flex",
                alignItems: "center",
                gap: 8,
                borderRadius: 9,
                border: "1px solid rgba(15,23,42,0.075)",
                background: "#ffffff",
                padding: "0 10px",
                boxShadow: "0 1px 2px rgba(15,23,42,0.035)",
              }}
            >
              <Search size={13} color="rgba(15,23,42,0.34)" />
              <input value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} placeholder="Markt, Kampagne, GM, Frage, Tag..." style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 11, fontWeight: 500, color: "#111827", fontFamily: "inherit" }} />
            </label>
            <button
              type="button"
              onClick={() => setFilterOpen(true)}
              style={{
                ...iconButtonStyle,
                height: 32,
                width: "auto",
                padding: "0 11px",
                gap: 7,
                color: filterCount > 0 ? R : "rgba(15,23,42,0.58)",
                border: filterCount > 0 ? "1px solid rgba(220,38,38,0.20)" : "1px solid rgba(15,23,42,0.08)",
                background: filterCount > 0 ? "rgba(220,38,38,0.065)" : "#ffffff",
                boxShadow: "0 1px 2px rgba(15,23,42,0.04)",
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              <Filter size={13} /> Filter{filterCount > 0 ? ` (${filterCount})` : ""}
            </button>
            <div style={{ display: "flex", height: 32, borderRadius: 9, border: "1px solid rgba(15,23,42,0.08)", background: "#fff", boxShadow: "0 1px 2px rgba(15,23,42,0.04)", overflow: "hidden" }}>
              <button type="button" aria-label="Rasteransicht" onClick={() => setViewMode("grid")} style={{ ...viewToggleButtonStyle, background: viewMode === "grid" ? "rgba(15,23,42,0.075)" : "transparent", color: viewMode === "grid" ? "#111827" : "rgba(15,23,42,0.35)" }}><Grid3X3 size={13} style={{ display: "block" }} /></button>
              <button type="button" aria-label="Listenansicht" onClick={() => setViewMode("list")} style={{ ...viewToggleButtonStyle, borderLeft: "1px solid rgba(15,23,42,0.06)", background: viewMode === "list" ? "rgba(15,23,42,0.075)" : "transparent", color: viewMode === "list" ? "#111827" : "rgba(15,23,42,0.35)" }}><List size={13} style={{ display: "block" }} /></button>
            </div>
          </div>
        </div>
      </section>

      {error && (
        <div style={{ borderRadius: 12, border: "1px solid rgba(220,38,38,0.18)", background: "rgba(220,38,38,0.06)", color: R, padding: 12, fontSize: 12, fontWeight: 800, marginBottom: 12 }}>
          {error}
        </div>
      )}
      {exportError && (
        <div style={{ borderRadius: 12, border: "1px solid rgba(220,38,38,0.18)", background: "rgba(220,38,38,0.06)", color: R, padding: 12, fontSize: 12, fontWeight: 800, marginBottom: 12 }}>
          {exportError}
        </div>
      )}

      <section style={{ borderRadius: 16, border: SOFT_BORDER, background: "#fff", boxShadow: PANEL_SHADOW, overflow: "hidden" }}>
        <div style={{ height: 44, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 14px", borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <SlidersHorizontal size={14} color="rgba(0,0,0,0.34)" />
            <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(0,0,0,0.38)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Archiv</span>
          </div>
          <span style={{ fontSize: 10, fontWeight: 600, color: "rgba(0,0,0,0.35)", fontVariantNumeric: "tabular-nums" }}>{photos.length} von {total}</span>
        </div>

        {loading ? (
          <div style={{ padding: 14, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: 12 }}>
            {Array.from({ length: 12 }).map((_, index) => <PhotoSkeleton key={index} />)}
          </div>
        ) : photos.length === 0 ? (
          <div style={{ minHeight: 360, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, color: "rgba(0,0,0,0.40)" }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: "rgba(0,0,0,0.04)", display: "flex", alignItems: "center", justifyContent: "center" }}><ImageOff size={24} strokeWidth={1.6} /></div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>Keine Fotos gefunden</div>
            <div style={{ fontSize: 11, fontWeight: 500 }}>Passe die Filter an oder wähle einen anderen Zeitraum.</div>
          </div>
        ) : viewMode === "grid" ? (
          <div style={{ padding: 14, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: 12 }}>
            {photos.map((photo) => (
              <PhotoTile
                key={photo.id}
                photo={photo}
                viewMode={viewMode}
                previewUrl={previewUrls[photo.id]}
                originalUrl={originalUrls[photo.id]}
                onPreviewVisible={requestPreviewUrl}
                onPreviewError={(photoId) => requestOriginalUrls([photoId])}
                onOpen={() => setSelectedPhotoId(photo.id)}
              />
            ))}
          </div>
        ) : (
          <div>{photos.map((photo) => (
            <PhotoTile
              key={photo.id}
              photo={photo}
              viewMode={viewMode}
              previewUrl={previewUrls[photo.id]}
              originalUrl={originalUrls[photo.id]}
              onPreviewVisible={requestPreviewUrl}
              onPreviewError={(photoId) => requestOriginalUrls([photoId])}
              onOpen={() => setSelectedPhotoId(photo.id)}
            />
          ))}</div>
        )}

        {hasMore && (
          <div style={{ display: "flex", justifyContent: "center", padding: "0 14px 16px" }}>
            <button type="button" disabled={loadingMore} onClick={() => setFilters((prev) => ({ ...prev, page: (prev.page ?? 1) + 1 }))} style={{ height: 34, borderRadius: 9, border: "none", background: "linear-gradient(to bottom, #fff, #f5f5f5)", boxShadow: BUTTON_SHADOW, padding: "0 16px", fontSize: 11, fontWeight: 700, color: "rgba(0,0,0,0.62)", cursor: loadingMore ? "default" : "pointer", opacity: loadingMore ? 0.6 : 1 }}>
              {loadingMore ? "Wird geladen..." : "Mehr laden"}
            </button>
          </div>
        )}
      </section>

      <FilterModal
        open={filterOpen}
        filters={filters}
        facets={facets}
        redMonths={redMonths}
        hideMhdCampaigns={isKunde}
        onClose={() => setFilterOpen(false)}
        onApply={applyFilters}
        onReset={() => applyFilters({ page: 1, pageSize: 30 })}
      />
      <FotoExportModal
        open={exportOpen}
        campaigns={campaignCatalog}
        photoCampaigns={facets.campaigns}
        chains={facets.chains}
        tags={facets.tags}
        redMonths={redMonths}
        exporting={isExporting}
        error={exportError}
        onClose={() => {
          if (!isExporting) setExportOpen(false);
        }}
        onExport={(exportFilters) => { void handleExport(exportFilters); }}
      />
      <DetailDrawer
        photo={selectedPhoto}
        loading={detailLoading}
        previewUrl={selectedPhoto ? previewUrls[selectedPhoto.id] : undefined}
        originalUrl={selectedPhoto ? originalUrls[selectedPhoto.id] : undefined}
        onOriginalNeeded={(photoId) => requestOriginalUrls([photoId])}
        canEditTags={readAuthSession()?.user.role === "admin"}
        onTagsUpdated={handlePhotoTagsUpdated}
        onClose={() => setSelectedPhotoId(null)}
      />
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ minWidth: 74, maxWidth: 160, padding: "1px 2px" }}>
      <div style={{ fontSize: 8.5, fontWeight: 700, color: "rgba(15,23,42,0.34)", letterSpacing: "0.085em", textTransform: "uppercase" }}>{label}</div>
      <div style={{ marginTop: 3, fontSize: 13, lineHeight: 1, fontWeight: 700, color: "#111827", letterSpacing: "-0.025em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</div>
    </div>
  );
}
