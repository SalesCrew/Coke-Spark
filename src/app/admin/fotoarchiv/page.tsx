"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  ExternalLink,
  Filter,
  Grid3X3,
  ImageOff,
  Images,
  List,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import {
  fetchAdminPhotoFacets,
  fetchAdminPhotos,
  fetchAdminPhotoSignedUrls,
  fetchRedMonthCalendar,
  readAuthSession,
  type AdminPhotoArchiveFacets,
  type AdminPhotoArchiveFilters,
  type AdminPhotoArchiveItem,
  type AdminPhotoSignedUrl,
  type AdminPhotoCampaignType,
} from "@/lib/api/backend";
import { exportFotoarchivImagesZip } from "@/lib/exports/analysisExports";
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
};

type ViewMode = "grid" | "list";
type Filters = AdminPhotoArchiveFilters & { redMonthId?: string };
type PhotoSignedUrlState = Pick<AdminPhotoSignedUrl, "signedUrl" | "expiresAt">;

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
  onClose,
  onApply,
  onReset,
}: {
  open: boolean;
  filters: Filters;
  facets: AdminPhotoArchiveFacets;
  redMonths: RedMonthPeriod[];
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
            <SelectField label="Typ" value={draft.campaignType} onChange={(value) => update({ campaignType: value as AdminPhotoCampaignType || undefined })} options={[{ value: "", label: "Alle Typen" }, ...Object.entries(TYPE_META).map(([value, meta]) => ({ value, label: meta.label }))]} />
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
  onClose,
}: {
  photo: AdminPhotoArchiveItem | null;
  loading: boolean;
  previewUrl?: PhotoSignedUrlState;
  originalUrl?: PhotoSignedUrlState;
  onOriginalNeeded: (photoId: string) => void;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const previewSrc = previewUrl?.signedUrl ?? "";
  const originalSrc = originalUrl?.signedUrl ?? "";
  const imageSrc = originalSrc || previewSrc;
  const meta = photo ? TYPE_META[photo.campaign.type] : TYPE_META.standard;
  const address = photo ? `${photo.market.address}, ${photo.market.postalCode} ${photo.market.city}` : "";

  useEffect(() => {
    if (photo && !originalSrc) onOriginalNeeded(photo.id);
  }, [onOriginalNeeded, originalSrc, photo]);

  if (!photo && !loading) return null;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1800, background: "rgba(15,23,42,0.20)", backdropFilter: "blur(8px)", display: "flex", justifyContent: "flex-end" }} onClick={onClose}>
      <aside onClick={(event) => event.stopPropagation()} style={{ width: "min(520px, calc(100vw - 28px))", height: "100%", background: "#fff", borderLeft: "1px solid rgba(0,0,0,0.08)", boxShadow: "-24px 0 60px rgba(15,23,42,0.16)", padding: 18, overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(0,0,0,0.34)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Fotodetail</div>
            <h2 style={{ margin: "3px 0 0", fontSize: 20, lineHeight: 1.05, letterSpacing: "-0.04em", color: "#111827" }}>{photo ? marketDisplayName(photo) : "Foto wird geladen"}</h2>
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
            <div style={{ borderRadius: 16, overflow: "hidden", background: "#f1f2f4", border: SOFT_BORDER, minHeight: 280, position: "relative" }}>
              {imageSrc ? (
                <img
                  src={imageSrc}
                  alt=""
                  decoding="async"
                  style={{ width: "100%", maxHeight: 480, objectFit: "contain", display: "block", background: "#f6f6f7", filter: originalSrc ? "none" : "saturate(0.94)", opacity: originalSrc ? 1 : 0.88 }}
                />
              ) : <div className="photoArchiveSkeleton" style={{ height: 320, display: "flex", alignItems: "center", justifyContent: "center" }}><ImageOff size={38} color="rgba(0,0,0,0.25)" /></div>}
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <a href={originalSrc || undefined} download style={{ textDecoration: "none" }}>
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
              <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(0,0,0,0.36)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>Datei</div>
              <InfoGrid rows={[
                ["Typ", photo.mimeType || "-"],
                ["Gr??e", fmtBytes(photo.byteSize)],
                ["Abmessung", photo.widthPx && photo.heightPx ? `${photo.widthPx} x ${photo.heightPx}` : "-"],
                ["Upload", fmtDateTime(photo.uploadedAt)],
              ]} />
              {photo.tags.length > 0 && <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 6 }}>{photo.tags.map((tag) => <span key={tag.id} style={tagStyle}>{tag.label}</span>)}</div>}
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
  const [filters, setFilters] = useState<Filters>(() => readFilters(new URLSearchParams(searchParams.toString())));
  const [searchDraft, setSearchDraft] = useState(filters.search ?? "");
  const [photos, setPhotos] = useState<AdminPhotoArchiveItem[]>([]);
  const [facets, setFacets] = useState<AdminPhotoArchiveFacets>(EMPTY_FACETS);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState({ visitedMarkets: 0, campaigns: 0 });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [redMonths, setRedMonths] = useState<RedMonthPeriod[]>([]);
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
    const now = new Date();
    const from = `${now.getFullYear() - 1}-01-01`;
    const to = `${now.getFullYear() + 1}-12-31`;
    void fetchRedMonthCalendar({ from, to }).then(setRedMonths).catch(() => setRedMonths([]));
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

  const handleExport = useCallback(async () => {
    if (isExporting) return;
    setIsExporting(true);
    setExportError(null);
    try {
      const pageSize = 80;
      let page = 1;
      let expectedTotal = 0;
      const allPhotos: AdminPhotoArchiveItem[] = [];
      while (page === 1 || allPhotos.length < expectedTotal) {
        const response = await fetchAdminPhotos({ ...filters, page, pageSize });
        expectedTotal = response.total;
        allPhotos.push(...response.photos);
        if (response.photos.length === 0) break;
        page += 1;
      }
      await exportFotoarchivImagesZip({
        photos: allPhotos,
        exportedBy: readAuthSession()?.user.email ?? "",
      });
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Fotoarchiv-Export konnte nicht erstellt werden.");
    } finally {
      setIsExporting(false);
    }
  }, [filters, isExporting]);

  useEffect(() => {
    const handler = () => { void handleExport(); };
    window.addEventListener("admin:fotoarchiv:export", handler);
    return () => window.removeEventListener("admin:fotoarchiv:export", handler);
  }, [handleExport]);

  return (
    <main style={{ minHeight: "calc(100vh - 80px)", padding: 18, background: "#f5f5f7", fontFamily: ADMIN_FONT_STACK }}>
      <style>{`
        @keyframes photoArchiveShimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }
        .photoArchiveSkeleton {
          background: linear-gradient(90deg, rgba(0,0,0,0.045), rgba(255,255,255,0.95), rgba(0,0,0,0.045));
          background-size: 220% 100%;
          animation: photoArchiveShimmer 1.15s ease-in-out infinite;
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
        onClose={() => setFilterOpen(false)}
        onApply={applyFilters}
        onReset={() => applyFilters({ page: 1, pageSize: 30 })}
      />
      <DetailDrawer
        photo={selectedPhoto}
        loading={detailLoading}
        previewUrl={selectedPhoto ? previewUrls[selectedPhoto.id] : undefined}
        originalUrl={selectedPhoto ? originalUrls[selectedPhoto.id] : undefined}
        onOriginalNeeded={(photoId) => requestOriginalUrls([photoId])}
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
