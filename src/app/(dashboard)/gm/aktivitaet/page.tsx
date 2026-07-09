"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Clock,
  FileText,
  ImageOff,
  Inbox,
  Loader2,
  MapPin,
  RefreshCcw,
  Send,
  Search,
  Store,
  Trash2,
  X,
} from "lucide-react";
import Aurora from "@/components/ui/Aurora";
import { CollapsibleMenu } from "@/components/ui/CollapsibleMenu";
import { GM_MENU_ITEMS } from "@/components/dashboard/gmMenuItems";
import {
  fetchGmAnswerChangeRequests,
  fetchGmCompletedVisitSessions,
  fetchGmVisitSession,
  fetchGmVisitSessionDeleteRequests,
  commitGmVisitPhotos,
  logoutCurrentUser,
  presignGmVisitPhoto,
  requestGmVisitAnswerChange,
  requestGmVisitSessionDelete,
  saveGmVisitAnswer,
  type GmAnswerChangeRequest,
  type GmCompletedVisitSummary,
  type GmVisitSessionDeleteRequest,
  type GmVisitSessionReadPayload,
} from "@/lib/api/backend";

const R = "#DC2626";
const GREEN = "#059669";
const FONT_STACK = "var(--font-inter), Inter, system-ui, sans-serif";

type VisitSection = GmVisitSessionReadPayload["sections"][number];
type VisitQuestion = VisitSection["questions"][number];
type ActivityQuestionEntry = {
  section: VisitSection;
  question: VisitQuestion;
  index: number;
};
type ActivityModuleGroup = {
  moduleId: string;
  moduleName: string;
  entries: ActivityQuestionEntry[];
};

function sectionLabel(section: VisitSection["section"] | GmCompletedVisitSummary["sections"][number]["section"]): string {
  if (section === "standard") return "Standard";
  if (section === "flex") return "Flex";
  if (section === "billa") return "Billa";
  if (section === "kuehler") return "Kühler";
  if (section === "mhd") return "MHD";
  return section;
}

function sectionColor(section: VisitSection["section"] | GmCompletedVisitSummary["sections"][number]["section"]): string {
  if (section === "flex") return "#65a30d";
  if (section === "billa") return "#0891b2";
  if (section === "kuehler") return "#d97706";
  if (section === "mhd") return "#7c3aed";
  return R;
}

function fmtDateTime(value: string | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "-";
  return date.toLocaleString("de-AT", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtDuration(minutes: number | null | undefined): string {
  if (minutes == null || !Number.isFinite(minutes)) return "-";
  const safe = Math.max(0, Math.round(minutes));
  if (safe < 60) return `${safe} Min`;
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

function marketTitle(market: { name: string; address: string; postalCode: string; city: string }): string {
  const name = market.name.trim();
  if (name) return name;
  return [market.address, `${market.postalCode} ${market.city}`.trim()].filter(Boolean).join(", ") || "Markt";
}

function marketAddress(market: { address: string; postalCode: string; city: string }): string {
  return [market.address, `${market.postalCode} ${market.city}`.trim()].filter(Boolean).join(", ");
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function jsonValuePreview(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(jsonValuePreview).filter(Boolean).join(", ");
  if (isPlainRecord(value)) {
    return Object.entries(value)
      .map(([key, entry]) => {
        const preview = jsonValuePreview(entry);
        return preview ? `${key}: ${preview}` : "";
      })
      .filter(Boolean)
      .join(" · ");
  }
  return "";
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    : [];
}

function configuredOptions(question: VisitQuestion): string[] {
  const config = question.config ?? {};
  if (question.type === "yesno") {
    const configured = stringArray(config.options);
    return configured.length ? configured : ["Ja", "Nein"];
  }
  if (question.type === "yesnomulti") {
    return stringArray(config.answers);
  }
  if (question.type === "likert") {
    const configured = stringArray(config.options);
    if (configured.length) return configured;
    const min = Number(config.min ?? 1);
    const max = Number(config.max ?? 5);
    if (Number.isFinite(min) && Number.isFinite(max) && max >= min && max - min <= 10) {
      return Array.from({ length: max - min + 1 }, (_unused, index) => String(min + index));
    }
  }
  return stringArray(config.options);
}

function yesNoMultiSubOptions(question: VisitQuestion, selectedTop: string): string[] {
  const branches = Array.isArray(question.config?.branches) ? question.config.branches : [];
  const branch = branches.find((entry) => isPlainRecord(entry) && entry.answer === selectedTop);
  return branch && isPlainRecord(branch) ? stringArray(branch.options) : [];
}

function truncateSummary(value: string): string {
  const clean = value.trim().replace(/\s+/g, " ");
  return clean.length > 180 ? `${clean.slice(0, 177)}...` : clean;
}

function questionAnswerSummary(question: VisitQuestion): string {
  const answer = question.answer;
  if (!answer || answer.answerStatus === "unanswered") return "Keine Antwort gespeichert";
  if (question.type === "photo") {
    const count = answer.photos.length;
    return count === 1 ? "1 Foto gespeichert" : `${count} Fotos gespeichert`;
  }
  if (question.type === "matrix") {
    const count = answer.matrixCells.filter((cell) => cell.cellSelected || cell.cellValueText || cell.cellValueDate).length;
    return count > 0 ? `${count} Matrix-Werte` : "Matrix gespeichert";
  }
  const options = answer.options
    .slice()
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .map((option) => option.optionValue)
    .filter(Boolean);
  if (options.length) return options.join(", ");
  if (answer.valueText?.trim()) return answer.valueText.trim();
  if (answer.valueNumber != null) return String(answer.valueNumber);
  const jsonPreview = jsonValuePreview(answer.valueJson);
  return jsonPreview || "Antwort gespeichert";
}

function hasStoredAnswer(question: VisitQuestion): boolean {
  return Boolean(question.answer && question.answer.answerStatus === "answered");
}

function questionTypeLabel(type: VisitQuestion["type"]): string {
  if (type === "single") return "Einzelauswahl";
  if (type === "yesno") return "Ja/Nein";
  if (type === "yesnomulti") return "Ja/Nein mit Auswahl";
  if (type === "multiple") return "Mehrfachauswahl";
  if (type === "likert") return "Skala";
  if (type === "text") return "Textantwort";
  if (type === "numeric") return "Zahlenfeld";
  if (type === "slider") return "Schieberegler";
  if (type === "photo") return "Foto-Frage";
  if (type === "matrix") return "Matrix";
  return "Frage";
}

type RequestStatusKind = "empty" | "pending" | "approved" | "rejected" | "mixed" | "cancelled";
type RequestHistoryGroup = {
  id: string;
  marketTitle: string;
  campaignTitle: string;
  section: GmAnswerChangeRequest["section"]["section"];
  createdAt: string;
  updatedAt: string;
  status: RequestStatusKind;
  requests: GmAnswerChangeRequest[];
  deleteRequests: GmVisitSessionDeleteRequest[];
};

function requestDate(value: string | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "-";
  return date.toLocaleString("de-AT", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function requestStatusLabel(status: RequestStatusKind): string {
  if (status === "pending") return "Ausstehend";
  if (status === "approved") return "Angenommen";
  if (status === "rejected") return "Abgelehnt";
  if (status === "mixed") return "Teilweise angenommen";
  if (status === "cancelled") return "Zurückgezogen";
  return "Keine Anfrage";
}

function answerSnapshotPreview(snapshot: Record<string, unknown>): string {
  const options = Array.isArray(snapshot.options)
    ? snapshot.options
        .map((entry) => {
          if (isPlainRecord(entry) && "optionValue" in entry) return String(entry.optionValue ?? "").trim();
          return String(entry ?? "").trim();
        })
        .filter(Boolean)
    : [];
  if (options.length > 0) return options.join(", ");

  const text = typeof snapshot.valueText === "string" ? snapshot.valueText.trim() : "";
  if (text) return text;
  if (snapshot.valueNumber !== null && snapshot.valueNumber !== undefined) return String(snapshot.valueNumber);

  const photos = Array.isArray(snapshot.photos) ? snapshot.photos : [];
  if (photos.length > 0) return `${photos.length} Foto${photos.length === 1 ? "" : "s"}`;

  const matrixCells = Array.isArray(snapshot.matrixCells) ? snapshot.matrixCells : [];
  if (matrixCells.length > 0) return `${matrixCells.length} Matrixwerte`;

  const json = jsonValuePreview(snapshot.valueJson);
  return json || "Keine Antwort";
}

function deriveRequestGroupStatus(requests: Array<{ status: GmAnswerChangeRequest["status"] }>): RequestStatusKind {
  if (requests.some((request) => request.status === "pending")) return "pending";
  const hasApproved = requests.some((request) => request.status === "approved");
  const hasRejected = requests.some((request) => request.status === "rejected");
  if (hasApproved && hasRejected) return "mixed";
  if (hasApproved) return "approved";
  if (hasRejected) return "rejected";
  if (requests.some((request) => request.status === "cancelled")) return "cancelled";
  return "empty";
}

function deleteRequestSection(request: GmVisitSessionDeleteRequest): GmAnswerChangeRequest["section"]["section"] {
  const summary = `${request.sectionSummary} ${request.campaignSummary}`.toLowerCase();
  if (summary.includes("kühler") || summary.includes("kuehler")) return "kuehler";
  if (summary.includes("mhd")) return "mhd";
  if (summary.includes("billa")) return "billa";
  if (summary.includes("flex")) return "flex";
  return "standard";
}

function buildRequestHistoryGroups(
  requests: GmAnswerChangeRequest[],
  deleteRequests: GmVisitSessionDeleteRequest[] = [],
): RequestHistoryGroup[] {
  const bySession = new Map<string, GmAnswerChangeRequest[]>();
  for (const request of requests) {
    const key = request.visitSessionId;
    bySession.set(key, [...(bySession.get(key) ?? []), request]);
  }
  const deleteBySession = new Map<string, GmVisitSessionDeleteRequest[]>();
  for (const request of deleteRequests) {
    const key = request.visitSessionId;
    deleteBySession.set(key, [...(deleteBySession.get(key) ?? []), request]);
  }
  const sessionIds = new Set([...bySession.keys(), ...deleteBySession.keys()]);
  return Array.from(sessionIds)
    .map((sessionId) => {
      const groupRequests = bySession.get(sessionId) ?? [];
      const groupDeleteRequests = deleteBySession.get(sessionId) ?? [];
      const sorted = [...groupRequests].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      const sortedDeleteRequests = [...groupDeleteRequests].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      const first = sorted[0];
      const firstDelete = sortedDeleteRequests[0];
      const allDates = [...sorted, ...sortedDeleteRequests];
      const newest = allDates
        .slice()
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];
      const oldest = allDates
        .slice()
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0];
      return {
        id: sessionId,
        marketTitle: first ? marketTitle(first.market) : firstDelete ? marketTitle(firstDelete.market) : "Markt",
        campaignTitle: first?.section.campaignName || first?.section.fragebogenName || firstDelete?.campaignSummary || "Fragebogen",
        section: first?.section.section ?? (firstDelete ? deleteRequestSection(firstDelete) : "standard"),
        createdAt: oldest?.createdAt ?? "",
        updatedAt: newest?.updatedAt ?? "",
        status: deriveRequestGroupStatus([...sorted, ...sortedDeleteRequests]),
        requests: sorted,
        deleteRequests: sortedDeleteRequests,
      };
    })
    .sort((a, b) => {
      if (a.status === "pending" && b.status !== "pending") return -1;
      if (a.status !== "pending" && b.status === "pending") return 1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
}

function RequestStatusIcon({ status, size = 18 }: { status: RequestStatusKind; size?: number }) {
  if (status === "pending") {
    return <span className="gm-activity-request-spinner" style={{ width: size, height: size }} aria-hidden="true" />;
  }
  if (status === "mixed") {
    return (
      <span className="gm-activity-request-icon-pair" aria-hidden="true">
        <span className="gm-activity-request-icon is-approved"><Check size={size - 8} strokeWidth={3} /></span>
        <span className="gm-activity-request-icon is-rejected"><X size={size - 8} strokeWidth={3} /></span>
      </span>
    );
  }
  if (status === "approved") {
    return <span className="gm-activity-request-icon is-approved" aria-hidden="true"><Check size={size - 7} strokeWidth={3} /></span>;
  }
  if (status === "rejected" || status === "cancelled") {
    return <span className="gm-activity-request-icon is-rejected" aria-hidden="true"><X size={size - 7} strokeWidth={3} /></span>;
  }
  return <span className="gm-activity-request-icon is-empty" aria-hidden="true"><Clock size={size - 7} strokeWidth={2.4} /></span>;
}

function CardShell({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <section
      style={{
        borderRadius: 18,
        border: "1px solid rgba(15,23,42,0.07)",
        background: "rgba(255,255,255,0.92)",
        boxShadow: "0 2px 8px rgba(15,23,42,0.04), 0 18px 42px rgba(15,23,42,0.045)",
        ...style,
      }}
    >
      {children}
    </section>
  );
}

function SkeletonBlock({ style }: { style?: CSSProperties }) {
  return <div className="gm-activity-skeleton" style={style} />;
}

function ActivitySkeleton() {
  return (
    <div className="gm-activity-list">
      {[0, 1, 2, 3].map((item) => (
        <CardShell key={item} style={{ padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 14 }}>
            <div style={{ flex: 1 }}>
              <SkeletonBlock style={{ width: 72, height: 20, borderRadius: 999 }} />
              <SkeletonBlock style={{ marginTop: 12, width: "58%", height: 18, borderRadius: 8 }} />
              <SkeletonBlock style={{ marginTop: 8, width: "75%", height: 10, borderRadius: 999 }} />
            </div>
            <SkeletonBlock style={{ width: 82, height: 52, borderRadius: 14 }} />
          </div>
          <SkeletonBlock style={{ marginTop: 16, height: 8, borderRadius: 999 }} />
        </CardShell>
      ))}
    </div>
  );
}

function StatTile({
  label,
  value,
  sub,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; color?: string }>;
  color: string;
}) {
  return (
    <CardShell style={{ padding: 14, minHeight: 102 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
        <div>
          <div className="gm-activity-label">{label}</div>
          <div style={{ marginTop: 9, fontSize: 27, lineHeight: 1, fontWeight: 770, letterSpacing: "-0.02em", color, fontVariantNumeric: "tabular-nums" }}>
            {value}
          </div>
        </div>
        <span style={{ width: 30, height: 30, borderRadius: 12, display: "inline-flex", alignItems: "center", justifyContent: "center", background: `${color}12`, boxShadow: `inset 0 0 0 1px ${color}22` }}>
          <Icon size={15} strokeWidth={2.1} color={color} />
        </span>
      </div>
      <div style={{ marginTop: 11, fontSize: 10, fontWeight: 650, color: "rgba(15,23,42,0.42)", lineHeight: 1.35 }}>{sub}</div>
    </CardShell>
  );
}

function VisitCard({
  visit,
  onOpen,
  isOpening,
}: {
  visit: GmCompletedVisitSummary;
  onOpen: (visit: GmCompletedVisitSummary) => void;
  isOpening: boolean;
}) {
  const firstSection = visit.sections[0];
  const accent = firstSection ? sectionColor(firstSection.section) : R;
  const progress = visit.totals.questionCount > 0
    ? Math.max(0, Math.min(100, Math.round((visit.totals.answeredCount / visit.totals.questionCount) * 100)))
    : 100;
  const names = Array.from(new Set(visit.sections.map((section) => section.campaignName || section.fragebogenName).filter(Boolean)));

  return (
    <button
      type="button"
      onClick={() => onOpen(visit)}
      disabled={isOpening}
      className="gm-activity-card"
      style={{ "--gm-activity-accent": accent } as CSSProperties}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
            {visit.sections.map((section) => (
              <span key={section.id} className="gm-activity-section-pill" style={{ color: sectionColor(section.section), background: `${sectionColor(section.section)}10`, boxShadow: `inset 0 0 0 1px ${sectionColor(section.section)}1f` }}>
                {sectionLabel(section.section)}
              </span>
            ))}
            <span className="gm-activity-date-pill">{fmtDateTime(visit.submittedAt)}</span>
          </div>
          <h2 className="gm-activity-card-title">{marketTitle(visit.market)}</h2>
          <div className="gm-activity-card-sub">
            <MapPin size={12} strokeWidth={2} />
            <span>{marketAddress(visit.market)}</span>
          </div>
          <div className="gm-activity-campaign-line">
            {names.length ? names.join(" · ") : "Abgeschlossener Fragebogen"}
          </div>
          {visit.kuehlerNumber && (
            <div className="gm-activity-campaign-line" style={{ color: "#0f766e" }}>
              Kühler {visit.kuehlerNumber}
            </div>
          )}
        </div>
        <div className="gm-activity-card-metric">
          <Clock size={12} strokeWidth={2} color="rgba(15,23,42,0.38)" />
          <strong>{fmtDuration(visit.durationMinutes)}</strong>
          <span>Dauer</span>
        </div>
      </div>

      <div className="gm-activity-progress-row">
        <span>{visit.totals.answeredCount}/{visit.totals.questionCount} Fragen</span>
        <span>{visit.totals.photoCount} Fotos</span>
      </div>
      <div className="gm-activity-progress-track">
        <div style={{ width: `${progress}%`, background: `linear-gradient(90deg, ${accent}, ${accent}aa)` }} />
      </div>

      <div className="gm-activity-card-footer">
        <span>
          <CheckCircle2 size={12} strokeWidth={2.2} />
          Read-only öffnen
        </span>
        {isOpening ? <Loader2 size={14} strokeWidth={2.2} className="animate-spin" /> : <ChevronRight size={15} strokeWidth={2.1} />}
      </div>
    </button>
  );
}

function AnswerChips({ values, color = R }: { values: string[]; color?: string }) {
  if (values.length === 0) return null;
  return (
    <div className="gm-activity-answer-chips">
      {values.map((value, index) => (
        <span key={`${value}-${index}`} style={{ color, background: `${color}0d`, boxShadow: `inset 0 0 0 1px ${color}20` }}>
          {value}
        </span>
      ))}
    </div>
  );
}

function MatrixAnswer({ question }: { question: VisitQuestion }) {
  const cells = question.answer?.matrixCells ?? [];
  if (cells.length === 0) return <div className="gm-activity-empty-answer">Keine Matrix-Werte gespeichert.</div>;
  const rows = Array.from(new Set(cells.map((cell) => cell.rowKey)));
  const columns = Array.from(new Set(cells.map((cell) => cell.columnKey)));
  return (
    <div className="gm-activity-matrix">
      <div className="gm-activity-matrix-head" style={{ gridTemplateColumns: `minmax(88px, 1.1fr) repeat(${columns.length}, minmax(74px, 1fr))` }}>
        <span />
        {columns.map((column) => <span key={column}>{column}</span>)}
      </div>
      {rows.map((row) => (
        <div key={row} className="gm-activity-matrix-row" style={{ gridTemplateColumns: `minmax(88px, 1.1fr) repeat(${columns.length}, minmax(74px, 1fr))` }}>
          <strong>{row}</strong>
          {columns.map((column) => {
            const cell = cells.find((entry) => entry.rowKey === row && entry.columnKey === column);
            const value = cell?.cellValueText ?? cell?.cellValueDate ?? (cell?.cellSelected ? "Ja" : "");
            return <span key={`${row}-${column}`}>{value || "–"}</span>;
          })}
        </div>
      ))}
    </div>
  );
}

type ActivityPhotoTagMode = "all" | "perPhoto";

type ActivityPhotoEntry = {
  key: string;
  id?: string;
  storageBucket?: string;
  storagePath?: string;
  signedUrl?: string | null;
  mimeType?: string | null;
  byteSize?: number | null;
  widthPx?: number | null;
  heightPx?: number | null;
  sha256?: string | null;
  tagIds: string[];
  file?: File;
  previewUrl?: string;
};

type ActivityPhotoTagMeta = {
  id: string;
  label: string;
};

function normalizePhotoTagIds(values: unknown[]): string[] {
  return Array.from(
    new Set(
      values
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  );
}

function samePhotoTagSet(left: string[], right: string[]): boolean {
  const normalizedLeft = normalizePhotoTagIds(left).sort();
  const normalizedRight = normalizePhotoTagIds(right).sort();
  return normalizedLeft.length === normalizedRight.length && normalizedLeft.every((value, index) => value === normalizedRight[index]);
}

function unionPhotoTagIds(groups: string[][]): string[] {
  return normalizePhotoTagIds(groups.flat());
}

function normalizeTagSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("de-AT")
    .trim();
}

function configuredPhotoTags(question: VisitQuestion): ActivityPhotoTagMeta[] {
  const config = question.config ?? {};
  const tagIds = Array.isArray(config.tagIds) ? config.tagIds.filter((id): id is string => typeof id === "string") : [];
  const meta = Array.isArray(config.tagMeta)
    ? config.tagMeta.filter((entry): entry is { id: string; label: string } => (
        isPlainRecord(entry)
        && typeof entry.id === "string"
        && typeof entry.label === "string"
      ))
    : [];
  return tagIds.map((id) => {
    const match = meta.find((entry) => entry.id === id);
    return { id, label: match?.label || id };
  });
}

function initialActivityPhotoState(question: VisitQuestion): {
  photos: ActivityPhotoEntry[];
  tagMode: ActivityPhotoTagMode;
  sharedTagIds: string[];
} {
  const photos = (question.answer?.photos ?? []).map((photo, index): ActivityPhotoEntry => ({
    key: photo.storagePath || photo.id || `photo-${index}`,
    id: photo.id,
    storageBucket: photo.storageBucket,
    storagePath: photo.storagePath,
    signedUrl: photo.signedUrl ?? null,
    mimeType: photo.mimeType,
    byteSize: photo.byteSize,
    widthPx: photo.widthPx,
    heightPx: photo.heightPx,
    sha256: photo.sha256,
    tagIds: normalizePhotoTagIds(photo.tags.map((tag) => tag.photoTagId).filter(Boolean)),
  }));
  const tagGroups = photos.map((photo) => photo.tagIds);
  const firstGroup = tagGroups[0] ?? [];
  const tagsAreShared = tagGroups.length <= 1 || tagGroups.every((group) => samePhotoTagSet(group, firstGroup));
  return {
    photos,
    tagMode: tagsAreShared ? "all" : "perPhoto",
    sharedTagIds: tagsAreShared ? normalizePhotoTagIds(firstGroup) : unionPhotoTagIds(tagGroups),
  };
}

function PhotoAnswer({ question }: { question: VisitQuestion }) {
  const photos = question.answer?.photos ?? [];
  if (photos.length === 0) return <div className="gm-activity-empty-answer">Keine Fotos gespeichert.</div>;
  return (
    <div className="gm-activity-photo-grid">
      {photos.map((photo) => (
        <figure key={photo.id} className="gm-activity-photo">
          {photo.signedUrl ? (
            <img src={photo.signedUrl} alt="Gespeichertes Fragebogenfoto" />
          ) : (
            <div className="gm-activity-photo-missing">
              <ImageOff size={18} strokeWidth={2} />
            </div>
          )}
          {photo.tags.length ? (
            <figcaption>
              {photo.tags.map((tag) => tag.photoTagLabelSnapshot).filter(Boolean).join(", ")}
            </figcaption>
          ) : null}
        </figure>
      ))}
    </div>
  );
}

function PhotoDirectEditForm({
  sessionId,
  question,
  accent,
  onClose,
  onSaved,
}: {
  sessionId: string;
  question: VisitQuestion;
  accent: string;
  onClose: () => void;
  onSaved: (message: string) => Promise<void>;
}) {
  const initial = useMemo(() => initialActivityPhotoState(question), [question]);
  const configuredTags = useMemo(() => configuredPhotoTags(question), [question]);
  const [photos, setPhotos] = useState<ActivityPhotoEntry[]>(initial.photos);
  const [tagMode, setTagMode] = useState<ActivityPhotoTagMode>(initial.tagMode);
  const [sharedTagIds, setSharedTagIds] = useState<string[]>(initial.sharedTagIds);
  const [activePhotoKey, setActivePhotoKey] = useState(initial.photos[0]?.key ?? "");
  const [tagSearch, setTagSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const previewUrlsRef = useRef<string[]>([]);

  useEffect(() => () => {
    previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    previewUrlsRef.current = [];
  }, []);

  useEffect(() => {
    if (photos.length === 0) {
      setActivePhotoKey("");
      return;
    }
    if (!photos.some((photo) => photo.key === activePhotoKey)) {
      setActivePhotoKey(photos[0]?.key ?? "");
    }
  }, [activePhotoKey, photos]);

  const activePhoto = photos.find((photo) => photo.key === activePhotoKey) ?? photos[0] ?? null;
  const currentTagIds = tagMode === "all" ? sharedTagIds : normalizePhotoTagIds(activePhoto?.tagIds ?? []);
  const normalizedTagSearch = normalizeTagSearchText(tagSearch);
  const visibleTags = normalizedTagSearch
    ? configuredTags.filter((tag) => currentTagIds.includes(tag.id) || normalizeTagSearchText(tag.label).includes(normalizedTagSearch))
    : configuredTags;
  const tagsEnabled = configuredTags.length > 0;

  const addFiles = (files: File[]) => {
    if (files.length === 0) return;
    const nextPhotos = files.map((file): ActivityPhotoEntry => {
      const previewUrl = URL.createObjectURL(file);
      previewUrlsRef.current.push(previewUrl);
      const key = `local-${crypto.randomUUID()}`;
      return {
        key,
        file,
        previewUrl,
        mimeType: file.type || null,
        byteSize: file.size,
        tagIds: tagMode === "all" ? normalizePhotoTagIds(sharedTagIds) : [],
      };
    });
    setPhotos((current) => [...current, ...nextPhotos]);
    setActivePhotoKey(nextPhotos[0]?.key ?? activePhotoKey);
  };

  const removePhoto = (key: string) => {
    setPhotos((current) => current.filter((photo) => photo.key !== key));
  };

  const switchTagMode = (nextMode: ActivityPhotoTagMode) => {
    if (nextMode === tagMode) return;
    if (nextMode === "perPhoto") {
      setPhotos((current) => current.map((photo) => ({ ...photo, tagIds: normalizePhotoTagIds(sharedTagIds) })));
      setTagMode("perPhoto");
      return;
    }
    const nextShared = unionPhotoTagIds(photos.map((photo) => photo.tagIds));
    setSharedTagIds(nextShared);
    setTagMode("all");
  };

  const toggleTag = (tagId: string) => {
    if (tagMode === "all") {
      setSharedTagIds((current) => current.includes(tagId) ? current.filter((id) => id !== tagId) : [...current, tagId]);
      return;
    }
    if (!activePhoto) return;
    setPhotos((current) => current.map((photo) => {
      if (photo.key !== activePhoto.key) return photo;
      const nextTags = photo.tagIds.includes(tagId)
        ? photo.tagIds.filter((id) => id !== tagId)
        : [...photo.tagIds, tagId];
      return { ...photo, tagIds: normalizePhotoTagIds(nextTags) };
    }));
  };

  const save = async () => {
    if (question.required && photos.length === 0) {
      setError("Diese Foto-Frage braucht mindestens ein Foto.");
      return;
    }
    if (question.required && tagsEnabled) {
      const validTags = tagMode === "all"
        ? sharedTagIds.length > 0
        : photos.every((photo) => normalizePhotoTagIds(photo.tagIds).length > 0);
      if (!validTags) {
        setError(tagMode === "all" ? "Bitte waehle mindestens einen Tag aus." : "Bitte tagge jedes Foto.");
        return;
      }
    }

    setSaving(true);
    setError(null);
    try {
      const answerId = question.answer?.id
        ?? (await saveGmVisitAnswer({ sessionId, visitQuestionId: question.id })).result.answerId;
      const committedPhotos = [];
      for (const photo of photos) {
        const photoTagIds = tagMode === "all" ? normalizePhotoTagIds(sharedTagIds) : normalizePhotoTagIds(photo.tagIds);
        if (photo.file) {
          const ext = (photo.file.name.split(".").pop() ?? "jpg").toLowerCase();
          const presign = await presignGmVisitPhoto({ sessionId, visitAnswerId: answerId, extension: ext });
          const uploadResponse = await fetch(presign.upload.signedUrl, {
            method: "PUT",
            headers: { "content-type": photo.file.type || "application/octet-stream" },
            body: photo.file,
          });
          if (!uploadResponse.ok) throw new Error("Foto-Upload fehlgeschlagen.");
          committedPhotos.push({
            storageBucket: presign.upload.bucket,
            storagePath: presign.upload.path,
            mimeType: photo.file.type || undefined,
            byteSize: photo.file.size,
            photoTagIds,
          });
          continue;
        }
        if (!photo.storageBucket || !photo.storagePath) continue;
        committedPhotos.push({
          storageBucket: photo.storageBucket,
          storagePath: photo.storagePath,
          mimeType: photo.mimeType ?? undefined,
          byteSize: photo.byteSize ?? undefined,
          widthPx: photo.widthPx ?? undefined,
          heightPx: photo.heightPx ?? undefined,
          sha256: photo.sha256 ?? undefined,
          photoTagIds,
        });
      }
      await commitGmVisitPhotos({ sessionId, visitAnswerId: answerId, photos: committedPhotos });
      await onSaved("Fotos und Tags gespeichert.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fotos konnten nicht gespeichert werden.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="gm-activity-photo-editor">
      <div className="gm-activity-photo-editor-head">
        <div>
          <span>Foto-Antwort</span>
          <strong>Fotos und Tags direkt bearbeiten</strong>
        </div>
        <button type="button" onClick={onClose} aria-label="Foto-Bearbeitung schliessen">
          <X size={13} strokeWidth={2.2} />
        </button>
      </div>

      <div className="gm-activity-photo-editor-upload">
        <button type="button" onClick={() => cameraInputRef.current?.click()}>
          <Camera size={14} strokeWidth={2.1} />
          Kamera
        </button>
        <button type="button" onClick={() => galleryInputRef.current?.click()}>
          <ImageOff size={14} strokeWidth={2.1} />
          Galerie
        </button>
        <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" multiple hidden onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = "";
          addFiles(files);
        }} />
        <input ref={galleryInputRef} type="file" accept="image/*" multiple hidden onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = "";
          addFiles(files);
        }} />
      </div>

      {photos.length > 0 ? (
        <div className="gm-activity-photo-editor-grid">
          {photos.map((photo, index) => {
            const active = activePhoto?.key === photo.key;
            const src = photo.previewUrl ?? photo.signedUrl ?? "";
            const tagCount = tagMode === "all" ? sharedTagIds.length : photo.tagIds.length;
            return (
              <div
                key={photo.key}
                className={`gm-activity-photo-editor-card ${active ? "is-active" : ""}`}
                style={{ "--photo-accent": accent } as CSSProperties}
              >
                <button
                  type="button"
                  className="gm-activity-photo-select"
                  onClick={() => setActivePhotoKey(photo.key)}
                >
                  <span className="gm-activity-photo-thumb">
                    {src ? <img src={src} alt={`Foto ${index + 1}`} /> : <ImageOff size={17} strokeWidth={2} />}
                  </span>
                  <span className="gm-activity-photo-thumb-meta">
                    <strong>Foto {index + 1}</strong>
                    <em>{tagCount} Tags</em>
                  </span>
                </button>
                <button
                  type="button"
                  className="gm-activity-photo-remove"
                  onClick={() => removePhoto(photo.key)}
                  aria-label={`Foto ${index + 1} entfernen`}
                >
                  <X size={10} strokeWidth={2.5} />
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="gm-activity-photo-editor-empty">Noch keine Fotos in dieser Antwort.</div>
      )}

      {tagsEnabled ? (
        <div className="gm-activity-photo-tag-panel">
          {photos.length > 1 ? (
            <div className="gm-activity-photo-tag-mode">
              {(["all", "perPhoto"] as const).map((mode) => (
                <button key={mode} type="button" className={tagMode === mode ? "active" : ""} onClick={() => switchTagMode(mode)}>
                  {mode === "all" ? "Alle Fotos" : "Einzeln"}
                </button>
              ))}
              <span>{tagMode === "all" ? "gleiche Tags" : "pro Foto"}</span>
            </div>
          ) : null}
          <div className="gm-activity-photo-tag-search">
            <Search size={12} strokeWidth={2} />
            <input value={tagSearch} onChange={(event) => setTagSearch(event.target.value)} placeholder="Tag suchen..." />
          </div>
          <div className="gm-activity-photo-tag-list">
            {visibleTags.map((tag) => {
              const selected = currentTagIds.includes(tag.id);
              return (
                <button key={tag.id} type="button" className={selected ? "selected" : ""} onClick={() => toggleTag(tag.id)}>
                  {selected ? <Check size={10} strokeWidth={2.5} /> : null}
                  {tag.label}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {error ? <div className="gm-activity-request-error">{error}</div> : null}
      <div className="gm-activity-photo-editor-actions">
        <button type="button" onClick={onClose} disabled={saving}>Abbrechen</button>
        <button type="button" onClick={() => { void save(); }} disabled={saving}>
          {saving ? <Loader2 size={14} strokeWidth={2.2} className="animate-spin" /> : <Check size={14} strokeWidth={2.2} />}
          Direkt speichern
        </button>
      </div>
    </div>
  );
}

function ReadOnlyAnswer({ question, accent }: { question: VisitQuestion; accent: string }) {
  const answer = question.answer;
  if (!answer || answer.answerStatus === "unanswered") {
    return <div className="gm-activity-empty-answer">Keine Antwort gespeichert.</div>;
  }
  if (question.type === "photo") return <PhotoAnswer question={question} />;
  if (question.type === "matrix") return <MatrixAnswer question={question} />;

  const topValues = answer.options.filter((option) => option.optionRole === "top").sort((a, b) => a.orderIndex - b.orderIndex).map((option) => option.optionValue);
  const subValues = answer.options.filter((option) => option.optionRole !== "top").sort((a, b) => a.orderIndex - b.orderIndex).map((option) => option.optionValue);
  const rawValues = [
    ...(topValues.length ? topValues : []),
    ...(subValues.length ? subValues : []),
  ];
  if (rawValues.length) return <AnswerChips values={rawValues} color={accent} />;
  if (answer.valueText?.trim()) return <div className="gm-activity-text-answer">{answer.valueText}</div>;
  if (answer.valueNumber != null) return <div className="gm-activity-number-answer">{answer.valueNumber}</div>;
  const jsonPreview = jsonValuePreview(answer.valueJson);
  if (jsonPreview) return <div className="gm-activity-text-answer">{jsonPreview}</div>;
  return <div className="gm-activity-empty-answer">Antwort gespeichert.</div>;
}

function ChangeRequestForm({
  sessionId,
  question,
  accent,
  onClose,
  onSubmitted,
}: {
  sessionId: string;
  question: VisitQuestion;
  accent: string;
  onClose: () => void;
  onSubmitted: (message: string) => void;
}) {
  const options = useMemo(() => configuredOptions(question), [question]);
  const defaultOption = options[0] ?? "";
  const [singleValue, setSingleValue] = useState(defaultOption);
  const [multiValues, setMultiValues] = useState<string[]>(defaultOption ? [defaultOption] : []);
  const [yesNoTop, setYesNoTop] = useState(defaultOption);
  const [yesNoSubs, setYesNoSubs] = useState<string[]>([]);
  const [textValue, setTextValue] = useState("");
  const [numberValue, setNumberValue] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const next = options[0] ?? "";
    setSingleValue(next);
    setMultiValues(next ? [next] : []);
    setYesNoTop(next);
    setYesNoSubs([]);
    setTextValue("");
    setNumberValue("");
    setNote("");
    setError(null);
  }, [options, question.id]);

  const yesNoSubOptions = useMemo(() => yesNoMultiSubOptions(question, yesNoTop), [question, yesNoTop]);

  const toggleMulti = (value: string) => {
    setMultiValues((current) => current.includes(value) ? current.filter((entry) => entry !== value) : [...current, value]);
  };

  const renderChoiceRows = (
    values: string[],
    marker: "radio" | "checkbox",
    isSelected: (value: string) => boolean,
    onSelect: (value: string) => void,
  ) => (
    <div className="gm-activity-request-choice-list">
      {values.map((option) => {
        const selected = isSelected(option);
        return (
          <button
            key={option}
            type="button"
            onClick={() => onSelect(option)}
            className={selected ? "gm-activity-request-choice selected" : "gm-activity-request-choice"}
          >
            <span className={`gm-activity-request-choice-marker ${marker}`}>
              {selected ? <Check size={8} strokeWidth={3} /> : null}
            </span>
            <span>{option}</span>
          </button>
        );
      })}
    </div>
  );

  const renderYesNoButtons = (
    values: string[],
    selectedValue: string,
    onSelect: (value: string) => void,
  ) => (
    <div className="gm-activity-request-yn-row">
      {values.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onSelect(option)}
          className={selectedValue === option ? "selected" : ""}
        >
          {option}
        </button>
      ))}
    </div>
  );

  const buildProposal = (): { payload: Record<string, unknown>; summary: string } | null => {
    if (question.type === "single" || question.type === "yesno" || question.type === "likert") {
      const value = singleValue.trim();
      if (!value) return null;
      return { payload: { type: question.type, value }, summary: value };
    }
    if (question.type === "multiple") {
      if (options.length === 0) {
        const value = textValue.trim();
        if (!value) return null;
        return { payload: { type: question.type, value }, summary: truncateSummary(value) };
      }
      if (multiValues.length === 0) return null;
      return { payload: { type: question.type, values: multiValues }, summary: multiValues.join(", ") };
    }
    if (question.type === "yesnomulti") {
      if (options.length === 0) {
        const value = textValue.trim();
        if (!value) return null;
        return { payload: { type: question.type, value }, summary: truncateSummary(value) };
      }
      const top = yesNoTop.trim();
      if (!top) return null;
      const subs = yesNoSubs.filter(Boolean);
      return {
        payload: { type: question.type, top, subs },
        summary: subs.length ? `${top}: ${subs.join(", ")}` : top,
      };
    }
    if (question.type === "numeric" || question.type === "slider") {
      const value = numberValue.trim();
      if (!value || !Number.isFinite(Number(value))) return null;
      return { payload: { type: question.type, value: Number(value) }, summary: value };
    }
    const value = textValue.trim();
    if (!value) return null;
    return {
      payload: { type: question.type, value },
      summary: truncateSummary(value),
    };
  };

  const submit = async () => {
    const proposal = buildProposal();
    if (!proposal) {
      setError("Bitte gib die gewünschte neue Antwort ein.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await requestGmVisitAnswerChange({
        sessionId,
        visitQuestionId: question.id,
        requestedAnswerPayload: proposal.payload,
        requestedAnswerSummary: proposal.summary,
        requestNote: note,
      });
      onSubmitted("Änderungsanfrage gespeichert.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Änderungsanfrage konnte nicht gespeichert werden.");
    } finally {
      setSubmitting(false);
    }
  };

  const renderProposalControl = () => {
    if (question.type === "yesno") {
      return options.length ? renderYesNoButtons(options, singleValue, setSingleValue) : (
        <input
          className="gm-activity-request-input"
          value={singleValue}
          onChange={(event) => setSingleValue(event.target.value)}
          placeholder="Neue Antwort"
        />
      );
    }
    if (question.type === "single") {
      return options.length ? renderChoiceRows(options, "radio", (value) => singleValue === value, setSingleValue) : (
        <input
          className="gm-activity-request-input"
          value={singleValue}
          onChange={(event) => setSingleValue(event.target.value)}
          placeholder="Neue Antwort"
        />
      );
    }
    if (question.type === "likert") {
      return options.length ? (
        <div className="gm-activity-request-likert">
          <div className="gm-activity-request-likert-scale">
            {options.map((option, index) => (
              <button
                key={option}
                type="button"
                onClick={() => setSingleValue(option)}
                className={singleValue === option ? "selected" : ""}
                style={{ "--likert-hue": Math.round((142 * index) / Math.max(options.length - 1, 1)) } as CSSProperties}
              >
                {option}
              </button>
            ))}
          </div>
          <div className="gm-activity-request-likert-labels">
            <span>{typeof question.config?.minLabel === "string" ? question.config.minLabel : "niedrig"}</span>
            <span>{typeof question.config?.maxLabel === "string" ? question.config.maxLabel : "hoch"}</span>
          </div>
        </div>
      ) : (
        <input
          className="gm-activity-request-input"
          value={singleValue}
          onChange={(event) => setSingleValue(event.target.value)}
          placeholder="Neue Antwort"
        />
      );
    }
    if (question.type === "multiple") {
      return options.length ? renderChoiceRows(options, "checkbox", (value) => multiValues.includes(value), toggleMulti) : (
        <div className="gm-activity-request-writing-card">
          <textarea
            className="gm-activity-request-textarea"
            value={textValue}
            onChange={(event) => setTextValue(event.target.value)}
            placeholder="Neue Antwort beschreiben"
          />
        </div>
      );
    }
    if (question.type === "yesnomulti") {
      if (options.length === 0) {
        return (
          <div className="gm-activity-request-writing-card">
            <textarea
              className="gm-activity-request-textarea"
              value={textValue}
              onChange={(event) => setTextValue(event.target.value)}
              placeholder="Gewünschte neue Antwort beschreiben"
            />
          </div>
        );
      }
      return (
        <div className="gm-activity-request-ynm">
          {renderYesNoButtons(options, yesNoTop, (option) => {
            setYesNoTop(option);
            setYesNoSubs([]);
          })}
          {yesNoSubOptions.length ? (
            <div className="gm-activity-request-subchoice-panel">
              <div className="gm-activity-request-subchoice-head">
                <span>Optionen für "{yesNoTop}"</span>
                {yesNoSubs.length ? <strong>{yesNoSubs.length} gewählt</strong> : null}
              </div>
              {yesNoSubOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setYesNoSubs((current) => current.includes(option) ? current.filter((entry) => entry !== option) : [...current, option])}
                  className={yesNoSubs.includes(option) ? "gm-activity-request-subchoice selected" : "gm-activity-request-subchoice"}
                >
                  <span>{yesNoSubs.includes(option) ? <Check size={7} strokeWidth={3} /> : null}</span>
                  {option}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      );
    }
    if (question.type === "slider") {
      const min = Number(question.config?.min ?? 0);
      const max = Number(question.config?.max ?? 100);
      const step = Number(question.config?.step ?? 1);
      const current = Number(numberValue);
      const safeValue = Number.isFinite(current) ? current : min;
      const pct = max > min ? Math.max(0, Math.min(100, ((safeValue - min) / (max - min)) * 100)) : 0;
      const unit = typeof question.config?.unit === "string" ? question.config.unit : "";
      return (
        <div className="gm-activity-request-slider-card">
          <div className="gm-activity-request-slider-values">
            <span>{min}{unit}</span>
            <strong>{numberValue || "Wert"}{numberValue ? unit : ""}</strong>
            <span>{max}{unit}</span>
          </div>
          <div className="gm-activity-request-slider-track">
            <div style={{ width: `${pct}%` }} />
            <input
              type="range"
              min={min}
              max={max}
              step={Number.isFinite(step) && step > 0 ? step : 1}
              value={safeValue}
              onChange={(event) => setNumberValue(event.target.value)}
            />
            <span style={{ left: `calc(${pct}% - 6px)` }} />
          </div>
        </div>
      );
    }
    if (question.type === "numeric") {
      return (
        <div className="gm-activity-request-number-card">
          <input
            className="gm-activity-request-input"
            type="number"
            inputMode="decimal"
            value={numberValue}
            onChange={(event) => setNumberValue(event.target.value)}
            placeholder="0"
          />
        </div>
      );
    }
    if (question.type === "photo") {
      return (
        <div className="gm-activity-request-writing-card gm-activity-request-photo-card">
          <div>
            <Camera size={14} strokeWidth={2.1} />
            <span>Foto oder Tags korrigieren</span>
          </div>
          <textarea
            className="gm-activity-request-textarea"
            value={textValue}
            onChange={(event) => setTextValue(event.target.value)}
            placeholder="Welche Foto-/Tag-Änderung soll gemacht werden?"
          />
        </div>
      );
    }
    if (question.type === "matrix") {
      return (
        <div className="gm-activity-request-writing-card gm-activity-request-matrix-card">
          <div className="gm-activity-request-matrix-preview">
            <span>Zeile</span>
            <span>Spalte</span>
            <span>Neuer Wert</span>
          </div>
          <textarea
            className="gm-activity-request-textarea"
            value={textValue}
            onChange={(event) => setTextValue(event.target.value)}
            placeholder="Bitte Zeile, Spalte und gewünschten Wert beschreiben"
          />
        </div>
      );
    }
    return (
      <div className="gm-activity-request-writing-card">
        <textarea
          className="gm-activity-request-textarea"
          value={textValue}
          onChange={(event) => setTextValue(event.target.value)}
          placeholder="Gewünschte Antwort oder Korrektur beschreiben"
        />
      </div>
    );
  };

  return (
    <div className="gm-activity-request-modal-backdrop" role="presentation" style={{ "--gm-request-accent": accent } as CSSProperties}>
      <div className="gm-activity-request-modal" role="dialog" aria-modal="true" aria-labelledby="gm-change-request-title">
        <div className="gm-activity-request-head">
          <div className="gm-activity-request-mark">
            <span />
          </div>
          <div className="gm-activity-request-title">
            <span>Änderung anfragen</span>
            <strong id="gm-change-request-title">Neue Antwort vorschlagen</strong>
            <p>Die gespeicherte Antwort bleibt unverändert, bis ein Admin die Anfrage prüft.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Änderungsanfrage schließen">
            <X size={14} strokeWidth={2.2} />
          </button>
        </div>

        <div className="gm-activity-request-current">
          <span>Aktuell gespeichert</span>
          <strong>{questionAnswerSummary(question)}</strong>
        </div>

        <div className="gm-activity-request-field">
          <label>Gewünschte Antwort</label>
          {renderProposalControl()}
        </div>

        <div className="gm-activity-request-field">
          <label>Hinweis für Admin</label>
          <textarea
            className="gm-activity-request-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Optional kurz erklären, warum die Antwort angepasst werden soll"
          />
        </div>

        {error ? <div className="gm-activity-request-error">{error}</div> : null}
        <div className="gm-activity-request-actions">
          <button type="button" onClick={onClose} disabled={submitting}>
            Abbrechen
          </button>
          <button type="button" onClick={() => { void submit(); }} disabled={submitting}>
            {submitting ? <Loader2 size={14} strokeWidth={2.2} className="animate-spin" /> : <Send size={14} strokeWidth={2.2} />}
            Anfrage senden
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteVisitRequestModal({
  sessionId,
  accent,
  onClose,
  onSubmitted,
}: {
  sessionId: string;
  accent: string;
  onClose: () => void;
  onSubmitted: (message: string) => void;
}) {
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await requestGmVisitSessionDelete({
        sessionId,
        requestNote: note.trim() || undefined,
      });
      onSubmitted("Löschanfrage gespeichert. Ein Admin prüft den Fragebogen.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Löschanfrage konnte nicht gesendet werden.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="gm-activity-request-modal-backdrop" role="presentation">
      <div className="gm-activity-request-modal is-delete" role="dialog" aria-modal="true" aria-labelledby="gm-delete-request-title">
        <header className="gm-activity-request-head">
          <span className="gm-activity-request-mark is-delete" style={{ color: accent }}>
            <Trash2 size={17} strokeWidth={2.2} />
          </span>
          <div>
            <span>Fragebogen löschen</span>
            <h3 id="gm-delete-request-title">Löschung anfragen</h3>
            <p>
              Der Besuch wird erst nach Admin-Freigabe entfernt. Andere Fragebögen und Antworten aus anderen Besuchen bleiben erhalten.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Schließen" disabled={submitting}>
            <X size={14} strokeWidth={2.3} />
          </button>
        </header>
        <div className="gm-activity-delete-request-warning">
          <strong>Wichtig</strong>
          <span>Nach Freigabe zählt dieser Marktbesuch nicht mehr in Auswertungen, Zeiterfassung, IPP oder Bonusdaten.</span>
        </div>
        <label className="gm-activity-request-field">
          <span>Grund / Hinweis optional</span>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={700}
            placeholder="Warum soll dieser Fragebogen gelöscht werden?"
          />
        </label>
        {error ? <div className="gm-activity-request-error">{error}</div> : null}
        <div className="gm-activity-request-actions">
          <button type="button" onClick={onClose} disabled={submitting}>
            Abbrechen
          </button>
          <button type="button" className="is-danger" onClick={() => { void submit(); }} disabled={submitting}>
            {submitting ? <Loader2 size={14} strokeWidth={2.2} className="animate-spin" /> : <Trash2 size={14} strokeWidth={2.2} />}
            Anfrage senden
          </button>
        </div>
      </div>
    </div>
  );
}

function ReadOnlyVisitViewer({
  payload,
  onClose,
  onPayloadUpdated,
  onChangeRequestSubmitted,
  deleteRequest,
  onDeleteRequestSubmitted,
}: {
  payload: GmVisitSessionReadPayload;
  onClose: () => void;
  onPayloadUpdated: (payload: GmVisitSessionReadPayload) => void;
  onChangeRequestSubmitted: () => void;
  deleteRequest: GmVisitSessionDeleteRequest | null;
  onDeleteRequestSubmitted: () => void;
}) {
  const questions = useMemo(() => (
    payload.sections
      .slice()
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .flatMap((section) => section.questions.map((question) => ({ section, question })))
  ), [payload.sections]);
  const [index, setIndex] = useState(0);
  const [changeRequestQuestionId, setChangeRequestQuestionId] = useState<string | null>(null);
  const [photoEditQuestionId, setPhotoEditQuestionId] = useState<string | null>(null);
  const [requestSuccessByQuestionId, setRequestSuccessByQuestionId] = useState<Record<string, string>>({});
  const [deleteRequestOpen, setDeleteRequestOpen] = useState(false);
  const [deleteRequestSuccess, setDeleteRequestSuccess] = useState<string | null>(null);
  const [navigatorOpen, setNavigatorOpen] = useState(false);
  const [activeNavigatorSectionId, setActiveNavigatorSectionId] = useState<string | null>(null);

  useEffect(() => {
    setIndex(0);
    setChangeRequestQuestionId(null);
    setPhotoEditQuestionId(null);
    setRequestSuccessByQuestionId({});
    setDeleteRequestOpen(false);
    setDeleteRequestSuccess(null);
    setNavigatorOpen(false);
    setActiveNavigatorSectionId(null);
  }, [payload.session.id]);

  const current = questions[index] ?? null;
  const accent = current ? sectionColor(current.section.section) : R;
  const percent = questions.length ? Math.round(((index + 1) / questions.length) * 100) : 0;
  const currentSuccess = current ? requestSuccessByQuestionId[current.question.id] : null;
  const navigatorSections = useMemo(() => {
    let questionIndex = 0;
    return payload.sections
      .slice()
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .map((section) => {
        const entries: ActivityQuestionEntry[] = section.questions.map((question) => ({
          section,
          question,
          index: questionIndex++,
        }));
        const moduleMap = new Map<string, ActivityModuleGroup>();

        for (const entry of entries) {
          const moduleId = entry.question.moduleId || `${section.id}:fallback`;
          const moduleName = entry.question.moduleName || section.fragebogenName || section.campaignName || sectionLabel(section.section);
          const existing = moduleMap.get(moduleId);
          if (existing) existing.entries.push(entry);
          else moduleMap.set(moduleId, { moduleId, moduleName, entries: [entry] });
        }

        return {
          section,
          entries,
          modules: Array.from(moduleMap.values()),
        };
      });
  }, [payload.sections]);
  const effectiveNavigatorSectionId = activeNavigatorSectionId && navigatorSections.some((entry) => entry.section.id === activeNavigatorSectionId)
    ? activeNavigatorSectionId
    : current?.section.id ?? navigatorSections[0]?.section.id ?? null;
  const activeNavigatorSection = navigatorSections.find((entry) => entry.section.id === effectiveNavigatorSectionId) ?? navigatorSections[0] ?? null;
  const currentModule = activeNavigatorSection?.modules.find((module) => module.entries.some((entry) => entry.index === index)) ?? null;
  const currentModuleLabel = currentModule?.moduleName ?? current?.section.fragebogenName ?? current?.section.campaignName ?? "Fragebogen";
  const jumpToQuestion = useCallback((nextIndex: number) => {
    const clamped = Math.max(0, Math.min(questions.length - 1, nextIndex));
    setIndex(clamped);
    const target = questions[clamped];
    setActiveNavigatorSectionId(target?.section.id ?? null);
    setNavigatorOpen(false);
  }, [questions]);

  useEffect(() => {
    if (!current) return;
    setActiveNavigatorSectionId((value) => value ?? current.section.id);
  }, [current]);

  return (
    <div className="gm-activity-viewer-backdrop">
      <div className="gm-activity-viewer">
        <header className="gm-activity-viewer-header">
          <button type="button" className="gm-activity-icon-button" onClick={onClose} aria-label="Zurück zur Aktivität">
            <ArrowLeft size={16} strokeWidth={2.2} />
          </button>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="gm-activity-viewer-eyebrow">Abgeschlossener Fragebogen</div>
            <h2>{marketTitle(payload.market)}</h2>
            <p>
              {marketAddress(payload.market)}
              {payload.session.kuehlerNumber ? ` · Kühler ${payload.session.kuehlerNumber}` : ""}
            </p>
          </div>
          <button type="button" className="gm-activity-icon-button" onClick={onClose} aria-label="Schließen">
            <X size={16} strokeWidth={2.2} />
          </button>
        </header>

        <div className="gm-activity-delete-request-bar">
          <div>
            <strong>Fragebogen entfernen</strong>
            <span>Nur mit Admin-Freigabe. Andere Besuche und gleiche Fragen in anderen Fragebögen bleiben erhalten.</span>
          </div>
          {deleteRequest?.status === "pending" ? (
            <button type="button" className="gm-activity-delete-request-open is-pending" disabled>
              <Clock size={13} strokeWidth={2.2} />
              Löschung offen
            </button>
          ) : deleteRequest?.status === "approved" ? (
            <button type="button" className="gm-activity-delete-request-open is-approved" disabled>
              <Check size={13} strokeWidth={2.4} />
              Löschung bestätigt
            </button>
          ) : (
            <button
              type="button"
              className="gm-activity-delete-request-open"
              onClick={() => setDeleteRequestOpen(true)}
            >
              <Trash2 size={13} strokeWidth={2.2} />
              Löschung anfragen
            </button>
          )}
        </div>

        {deleteRequestSuccess ? (
          <div className="gm-activity-delete-request-success">{deleteRequestSuccess}</div>
        ) : null}

        <div className="gm-activity-viewer-strip">
          <div>
            <span>Fortschritt</span>
            <strong>{index + 1}/{Math.max(questions.length, 1)}</strong>
          </div>
          <div className="gm-activity-viewer-progress">
            <div style={{ width: `${percent}%`, background: `linear-gradient(90deg, ${accent}, ${accent}99)` }} />
          </div>
          <span className="gm-activity-readonly-badge">Read-only</span>
        </div>

        {current ? (
          <section className="gm-activity-question-card" style={{ "--gm-question-accent": accent } as CSSProperties}>
            <div className="gm-activity-question-meta">
              <span style={{ color: accent }}>{sectionLabel(current.section.section)}</span>
              <span>{current.question.required ? "Pflichtfrage" : "Optional"}</span>
              <span>{questionAnswerSummary(current.question)}</span>
            </div>
            <div className="gm-activity-question-type-line">
              <i aria-hidden="true" />
              <span>Antwortformat</span>
              <strong>{questionTypeLabel(current.question.type)}</strong>
            </div>
            <h3>{current.question.text}</h3>
            <ReadOnlyAnswer question={current.question} accent={accent} />
            <div className="gm-activity-request-entry">
              {currentSuccess ? (
                <span className="gm-activity-request-success">{currentSuccess}</span>
              ) : null}
              {current.question.type === "photo" ? (
                photoEditQuestionId === current.question.id ? (
                  <PhotoDirectEditForm
                    sessionId={payload.session.id}
                    question={current.question}
                    accent={accent}
                    onClose={() => setPhotoEditQuestionId(null)}
                    onSaved={async (message) => {
                      const refreshed = await fetchGmVisitSession(payload.session.id);
                      onPayloadUpdated(refreshed);
                      setRequestSuccessByQuestionId((currentMap) => ({ ...currentMap, [current.question.id]: message }));
                      setPhotoEditQuestionId(null);
                    }}
                  />
                ) : (
                  <button
                    type="button"
                    className="gm-activity-request-open is-photo-direct"
                    onClick={() => setPhotoEditQuestionId(current.question.id)}
                  >
                    <Camera size={13} strokeWidth={2.2} />
                    Fotos & Tags bearbeiten
                  </button>
                )
              ) : changeRequestQuestionId === current.question.id ? (
                <ChangeRequestForm
                  sessionId={payload.session.id}
                  question={current.question}
                  accent={accent}
                  onClose={() => setChangeRequestQuestionId(null)}
                  onSubmitted={(message) => {
                    setRequestSuccessByQuestionId((currentMap) => ({ ...currentMap, [current.question.id]: message }));
                    setChangeRequestQuestionId(null);
                    onChangeRequestSubmitted();
                  }}
                />
              ) : (
                <button
                  type="button"
                  className="gm-activity-request-open"
                  onClick={() => setChangeRequestQuestionId(current.question.id)}
                >
                  <Send size={13} strokeWidth={2.2} />
                  Änderung anfragen
                </button>
              )}
            </div>
            {current.question.comment?.trim() ? (
              <div className="gm-activity-comment">
                <span>Kommentar</span>
                {current.question.comment}
              </div>
            ) : null}
          </section>
        ) : (
          <section className="gm-activity-question-card">
            <div className="gm-activity-empty-answer">Dieser Besuch enthält keine gespeicherten Fragen.</div>
          </section>
        )}

        {navigatorOpen ? (
          <div className="gm-activity-bottom-navigator">
            <div className="gm-activity-bottom-navigator-head">
              <div>
                <span>Navigation</span>
                <strong>Module & Fragen</strong>
              </div>
              <button type="button" onClick={() => setNavigatorOpen(false)} aria-label="Navigation schliessen">
                <X size={13} strokeWidth={2.3} />
              </button>
            </div>
            <div className="gm-activity-bottom-section-tabs">
              {navigatorSections.map(({ section, entries }) => {
                const color = sectionColor(section.section);
                const active = section.id === activeNavigatorSection?.section.id;
                const answered = entries.filter((entry) => hasStoredAnswer(entry.question)).length;
                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => setActiveNavigatorSectionId(section.id)}
                    style={{
                      color: active ? color : "rgba(15,23,42,0.48)",
                      background: active ? `${color}12` : "rgba(15,23,42,0.035)",
                      boxShadow: active ? `inset 0 0 0 1px ${color}24` : "inset 0 0 0 1px rgba(15,23,42,0.055)",
                    }}
                  >
                    <i style={{ background: active ? color : "rgba(15,23,42,0.16)" }} />
                    <span>{sectionLabel(section.section)}</span>
                    <small>{answered}/{entries.length}</small>
                  </button>
                );
              })}
            </div>
            <div className="gm-activity-bottom-module-list">
              {activeNavigatorSection?.modules.map((module) => {
                const moduleColor = sectionColor(activeNavigatorSection.section.section);
                const answered = module.entries.filter((entry) => hasStoredAnswer(entry.question)).length;
                const moduleActive = module.entries.some((entry) => entry.index === index);
                const complete = answered === module.entries.length && module.entries.length > 0;
                return (
                  <div
                    key={module.moduleId}
                    className="gm-activity-bottom-module"
                    style={{ "--gm-nav-accent": moduleColor } as CSSProperties}
                  >
                    <button
                      type="button"
                      className="gm-activity-bottom-module-title"
                      onClick={() => jumpToQuestion(module.entries[0]?.index ?? 0)}
                      style={{
                        background: moduleActive ? `${moduleColor}0c` : "transparent",
                        boxShadow: moduleActive ? `inset 0 0 0 1px ${moduleColor}20` : "none",
                      }}
                    >
                      <span className={complete ? "is-complete" : ""}>
                        {complete ? <Check size={9} strokeWidth={3} /> : `${answered}/${module.entries.length}`}
                      </span>
                      <strong>{module.moduleName}</strong>
                      <ChevronDown size={12} strokeWidth={2.3} />
                    </button>
                    <div className="gm-activity-bottom-question-list">
                      {module.entries.map((entry) => {
                        const done = hasStoredAnswer(entry.question);
                        const active = entry.index === index;
                        return (
                          <button
                            key={`${entry.question.id}-${entry.index}`}
                            type="button"
                            onClick={() => jumpToQuestion(entry.index)}
                            style={{
                              background: active ? `${moduleColor}0c` : "transparent",
                              boxShadow: active ? `inset 0 0 0 1px ${moduleColor}20` : "none",
                            }}
                          >
                            <span className={done ? "is-done" : ""}>
                              {done ? <Check size={7} strokeWidth={3} /> : entry.index + 1}
                            </span>
                            <p>{entry.question.text}</p>
                            {active ? <i style={{ background: moduleColor }} /> : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        <footer className="gm-activity-viewer-footer">
          <button
            type="button"
            onClick={() => jumpToQuestion(index - 1)}
            disabled={index <= 0}
          >
            <ChevronLeft size={15} strokeWidth={2.2} />
            Zurück
          </button>
          <button
            type="button"
            className="gm-activity-footer-navigator"
            onClick={() => setNavigatorOpen((value) => !value)}
            aria-expanded={navigatorOpen}
          >
            <span>{sectionLabel(current?.section.section ?? "standard")}</span>
            <strong>{currentModuleLabel}</strong>
            <div className="gm-activity-dot-row" aria-hidden="true">
              {questions.map((entry, itemIndex) => (
                <i
                  key={`${entry.section.id}-${entry.question.id}-${itemIndex}`}
                  style={{
                    background: itemIndex === index ? accent : itemIndex < index ? `${accent}99` : "rgba(15,23,42,0.12)",
                    transform: itemIndex === index ? "scale(1.22)" : "scale(1)",
                  }}
                />
              ))}
            </div>
          </button>
          <button
            type="button"
            onClick={() => jumpToQuestion(index + 1)}
            disabled={index >= questions.length - 1}
          >
            Weiter
            <ChevronRight size={15} strokeWidth={2.2} />
          </button>
        </footer>
      </div>
      {deleteRequestOpen ? (
        <DeleteVisitRequestModal
          sessionId={payload.session.id}
          accent={accent}
          onClose={() => setDeleteRequestOpen(false)}
          onSubmitted={(message) => {
            setDeleteRequestSuccess(message);
            setDeleteRequestOpen(false);
            onDeleteRequestSubmitted();
          }}
        />
      ) : null}
    </div>
  );
}

function ChangeRequestHistoryModal({
  groups,
  loading,
  error,
  onClose,
  onRefresh,
}: {
  groups: RequestHistoryGroup[];
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onRefresh: () => void;
}) {
  return (
    <div className="gm-activity-history-backdrop" role="presentation">
      <section className="gm-activity-history-modal" role="dialog" aria-modal="true" aria-labelledby="gm-request-history-title">
        <header className="gm-activity-history-head">
          <div>
            <span>Änderungen</span>
            <h2 id="gm-request-history-title">Anfragehistorie</h2>
            <p>Deine vorgeschlagenen Korrekturen und der aktuelle Prüfstatus.</p>
          </div>
          <div className="gm-activity-history-actions">
            <button type="button" onClick={onRefresh} disabled={loading} aria-label="Anfragen aktualisieren">
              {loading ? <Loader2 size={14} className="gm-activity-spin" /> : <RefreshCcw size={14} />}
            </button>
            <button type="button" onClick={onClose} aria-label="Schließen">
              <X size={14} />
            </button>
          </div>
        </header>

        {error ? <div className="gm-activity-history-error">{error}</div> : null}

        <div className="gm-activity-history-list">
          {loading && groups.length === 0 ? (
            [0, 1, 2].map((item) => (
              <div key={item} className="gm-activity-history-skeleton gm-activity-skeleton" />
            ))
          ) : groups.length === 0 ? (
            <div className="gm-activity-history-empty">
              <Inbox size={22} strokeWidth={1.9} />
              <strong>Noch keine Anfragen</strong>
              <span>Wenn du eine Änderung vorschlägst, erscheint sie hier.</span>
            </div>
          ) : (
            groups.map((group) => {
              const accent = sectionColor(group.section);
              return (
                <article key={group.id} className="gm-activity-history-group" style={{ "--gm-history-accent": accent } as CSSProperties}>
                  <div className="gm-activity-history-group-head">
                    <RequestStatusIcon status={group.status} />
                    <div>
                      <strong>{group.marketTitle}</strong>
                      <span>{sectionLabel(group.section)} · {group.campaignTitle}</span>
                    </div>
                    <small>{requestDate(group.updatedAt)}</small>
                  </div>
                  <div className="gm-activity-history-status-line">
                    <span>{requestStatusLabel(group.status)}</span>
                    <i />
                    <span>
                      {group.requests.length + group.deleteRequests.length} Anfrage
                      {group.requests.length + group.deleteRequests.length === 1 ? "" : "n"}
                    </span>
                  </div>
                  <div className="gm-activity-history-items">
                    {group.deleteRequests.map((request) => (
                      <div key={request.id} className="gm-activity-history-item is-delete">
                        <div className="gm-activity-history-item-top">
                          <RequestStatusIcon status={request.status as RequestStatusKind} size={16} />
                          <span>Fragebogen löschen</span>
                          <small>{request.status === "pending" ? requestDate(request.createdAt) : requestDate(request.reviewedAt ?? request.updatedAt)}</small>
                        </div>
                        <strong>{request.campaignSummary || "Fragebogen"}</strong>
                        <div className="gm-activity-history-diff">
                          <span>Aktiv in Auswertungen</span>
                          <ChevronRight size={12} strokeWidth={2.3} />
                          <b>Ausblenden / löschen</b>
                        </div>
                        {request.sectionSummary ? <p>{request.sectionSummary}</p> : null}
                        {request.requestNote ? <p>{request.requestNote}</p> : null}
                        {request.adminNote ? <p className="gm-activity-history-admin-note">{request.adminNote}</p> : null}
                      </div>
                    ))}
                    {group.requests.map((request) => (
                      <div key={request.id} className="gm-activity-history-item">
                        <div className="gm-activity-history-item-top">
                          <RequestStatusIcon status={request.status as RequestStatusKind} size={16} />
                          <span>{questionTypeLabel(request.questionType)}</span>
                          <small>{request.status === "pending" ? requestDate(request.createdAt) : requestDate(request.reviewedAt ?? request.updatedAt)}</small>
                        </div>
                        <strong>{request.questionText}</strong>
                        <div className="gm-activity-history-diff">
                          <span>{answerSnapshotPreview(request.currentAnswerSnapshot)}</span>
                          <ChevronRight size={12} strokeWidth={2.3} />
                          <b>{request.requestedAnswerSummary || "Neue Antwort"}</b>
                        </div>
                        {request.requestNote ? <p>{request.requestNote}</p> : null}
                        {request.adminNote ? <p className="gm-activity-history-admin-note">{request.adminNote}</p> : null}
                      </div>
                    ))}
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}

export default function GmActivityPage() {
  const router = useRouter();
  const [visits, setVisits] = useState<GmCompletedVisitSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sectionFilter, setSectionFilter] = useState<"all" | VisitSection["section"]>("all");
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [viewerPayload, setViewerPayload] = useState<GmVisitSessionReadPayload | null>(null);
  const [changeRequests, setChangeRequests] = useState<GmAnswerChangeRequest[]>([]);
  const [deleteRequests, setDeleteRequests] = useState<GmVisitSessionDeleteRequest[]>([]);
  const [changeRequestsLoading, setChangeRequestsLoading] = useState(true);
  const [changeRequestsError, setChangeRequestsError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const openingIdRef = useRef<string | null>(null);
  const initialOpenSessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetchGmCompletedVisitSessions({ limit: 100 })
      .then((result) => {
        if (cancelled) return;
        setVisits(result);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Aktivitäten konnten nicht geladen werden.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshCompletedVisits = useCallback(async () => {
    setError(null);
    try {
      const result = await fetchGmCompletedVisitSessions({ limit: 100 });
      setVisits(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "AktivitÃ¤ten konnten nicht geladen werden.");
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const refresh = () => {
      void refreshCompletedVisits();
    };
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    const refreshFromStorage = (event: StorageEvent) => {
      if (event.key === "gm:completed-visits-updated") refresh();
    };
    window.addEventListener("gm:completed-visits-updated", refresh);
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", refreshFromStorage);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.removeEventListener("gm:completed-visits-updated", refresh);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", refreshFromStorage);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [refreshCompletedVisits]);

  const loadChangeRequests = useCallback(async () => {
    setChangeRequestsLoading(true);
    setChangeRequestsError(null);
    try {
      const [answerResult, deleteResult] = await Promise.all([
        fetchGmAnswerChangeRequests(),
        fetchGmVisitSessionDeleteRequests(),
      ]);
      setChangeRequests(answerResult);
      setDeleteRequests(deleteResult);
    } catch (err) {
      setChangeRequestsError(err instanceof Error ? err.message : "Anfragen konnten nicht geladen werden.");
    } finally {
      setChangeRequestsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadChangeRequests();
  }, [loadChangeRequests]);

  const stats = useMemo(() => {
    const questionCount = visits.reduce((sum, visit) => sum + visit.totals.questionCount, 0);
    const photoCount = visits.reduce((sum, visit) => sum + visit.totals.photoCount, 0);
    const durations = visits.map((visit) => visit.durationMinutes).filter((value): value is number => typeof value === "number");
    const avgDuration = durations.length ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length) : null;
    return { questionCount, photoCount, avgDuration };
  }, [visits]);

  const filteredVisits = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return visits.filter((visit) => {
      const matchesSection = sectionFilter === "all" || visit.sections.some((section) => section.section === sectionFilter);
      if (!matchesSection) return false;
      if (!needle) return true;
      const haystack = [
        visit.market.name,
        visit.market.address,
        visit.market.postalCode,
        visit.market.city,
        ...visit.sections.flatMap((section) => [section.campaignName, section.fragebogenName, sectionLabel(section.section)]),
      ].join(" ").toLowerCase();
      return haystack.includes(needle);
    });
  }, [search, sectionFilter, visits]);

  const openVisitById = useCallback(async (sessionId: string) => {
    if (openingIdRef.current) return;
    openingIdRef.current = sessionId;
    setOpeningId(sessionId);
    setError(null);
    try {
      const payload = await fetchGmVisitSession(sessionId);
      setViewerPayload(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fragebogen konnte nicht geÃ¶ffnet werden.");
    } finally {
      openingIdRef.current = null;
      setOpeningId(null);
    }
  }, []);

  const openVisit = useCallback(async (visit: GmCompletedVisitSummary) => {
    if (openingId) return;
    setOpeningId(visit.id);
    setError(null);
    try {
      const payload = await fetchGmVisitSession(visit.id);
      setViewerPayload(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fragebogen konnte nicht geöffnet werden.");
    } finally {
      setOpeningId(null);
    }
  }, [openingId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("openSessionId") ?? params.get("sessionId");
    if (!sessionId || initialOpenSessionIdRef.current === sessionId) return;
    initialOpenSessionIdRef.current = sessionId;
    void openVisitById(sessionId).finally(() => {
      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.delete("openSessionId");
      nextUrl.searchParams.delete("sessionId");
      window.history.replaceState(null, "", `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
      void refreshCompletedVisits();
    });
  }, [openVisitById, refreshCompletedVisits]);

  const sectionOptions: Array<"all" | VisitSection["section"]> = ["all", "standard", "flex", "billa", "kuehler", "mhd"];
  const requestGroups = useMemo(() => buildRequestHistoryGroups(changeRequests, deleteRequests), [changeRequests, deleteRequests]);
  const pendingRequestCount = useMemo(
    () => changeRequests.filter((request) => request.status === "pending").length
      + deleteRequests.filter((request) => request.status === "pending").length,
    [changeRequests, deleteRequests],
  );
  const deleteRequestBySessionId = useMemo(() => {
    const map = new Map<string, GmVisitSessionDeleteRequest>();
    for (const request of [...deleteRequests].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())) {
      map.set(request.visitSessionId, request);
    }
    return map;
  }, [deleteRequests]);
  const featuredRequestGroup = requestGroups[0] ?? null;
  const featuredRequestStatus: RequestStatusKind = pendingRequestCount > 0 ? "pending" : featuredRequestGroup?.status ?? "empty";
  const featuredRequestTitle = changeRequestsLoading && changeRequests.length + deleteRequests.length === 0
    ? "Anfragen werden geladen"
    : pendingRequestCount > 0
      ? `${pendingRequestCount} Anfrage${pendingRequestCount === 1 ? "" : "n"} offen`
      : featuredRequestGroup
        ? `Letzte Anfrage: ${requestStatusLabel(featuredRequestGroup.status)}`
        : "Keine Anfragen";
  const featuredRequestSubtitle = featuredRequestGroup
    ? `${featuredRequestGroup.marketTitle} · ${requestDate(featuredRequestGroup.updatedAt)}`
    : "Historie anzeigen";

  return (
    <main className="gm-activity-page">
      <style>{`
        @keyframes gmActivityShimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }
        @keyframes gmActivitySpin { to { transform: rotate(360deg); } }
        .gm-activity-page {
          min-height: 100vh;
          background: #f5f5f7;
          color: rgba(15,23,42,0.92);
          font-family: ${FONT_STACK};
          padding-bottom: 116px;
          position: relative;
          overflow-x: hidden;
        }
        .gm-activity-skeleton {
          background: linear-gradient(90deg, rgba(15,23,42,0.045), rgba(255,255,255,0.94), rgba(15,23,42,0.045));
          background-size: 220% 100%;
          animation: gmActivityShimmer 1.15s ease-in-out infinite;
        }
        .gm-activity-label {
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.11em;
          text-transform: uppercase;
          color: rgba(15,23,42,0.34);
        }
        .gm-activity-stat-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 16px;
        }
        .gm-activity-toolbar {
          display: grid;
          grid-template-columns: minmax(190px, 0.72fr) minmax(220px, 0.5fr) auto;
          gap: 12px;
          align-items: center;
          margin-bottom: 14px;
        }
        .gm-activity-search {
          height: 38px;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 0 12px;
          border-radius: 12px;
          background: rgba(255,255,255,0.92);
          box-shadow: inset 0 0 0 1px rgba(15,23,42,0.06), 0 2px 8px rgba(15,23,42,0.035);
        }
        .gm-activity-search input {
          border: 0;
          outline: 0;
          background: transparent;
          min-width: 0;
          width: 100%;
          font: inherit;
          font-size: 12px;
          font-weight: 650;
          color: rgba(15,23,42,0.74);
        }
        .gm-activity-request-status-card {
          height: 38px;
          min-width: 0;
          border: 0;
          border-radius: 12px;
          padding: 0 12px;
          background: rgba(255,255,255,0.94);
          box-shadow: inset 0 0 0 1px rgba(15,23,42,0.06), 0 2px 8px rgba(15,23,42,0.035);
          display: grid;
          grid-template-columns: auto minmax(0, 1fr);
          align-items: center;
          gap: 9px;
          font-family: inherit;
          text-align: left;
          cursor: pointer;
          transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
        }
        .gm-activity-request-status-card:hover {
          transform: translateY(-1px);
          background: #fff;
          box-shadow: inset 0 0 0 1px rgba(15,23,42,0.07), 0 7px 18px rgba(15,23,42,0.065);
        }
        .gm-activity-request-status-text {
          min-width: 0;
          display: grid;
          gap: 1px;
        }
        .gm-activity-request-status-text strong {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 11px;
          line-height: 1.1;
          font-weight: 790;
          letter-spacing: -0.01em;
          color: rgba(15,23,42,0.78);
        }
        .gm-activity-request-status-text span {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 9px;
          line-height: 1.15;
          font-weight: 680;
          color: rgba(15,23,42,0.38);
        }
        .gm-activity-request-spinner {
          display: inline-block;
          border-radius: 999px;
          border: 2px solid rgba(217,119,6,0.18);
          border-top-color: #d97706;
          animation: gmActivitySpin 0.8s linear infinite;
        }
        .gm-activity-spin {
          animation: gmActivitySpin 0.8s linear infinite;
        }
        .gm-activity-request-icon,
        .gm-activity-request-icon-pair {
          width: 18px;
          height: 18px;
          display: inline-grid;
          place-items: center;
          border-radius: 999px;
          flex: 0 0 auto;
        }
        .gm-activity-request-icon.is-approved {
          color: #059669;
          background: rgba(5,150,105,0.1);
          box-shadow: inset 0 0 0 1px rgba(5,150,105,0.16);
        }
        .gm-activity-request-icon.is-rejected {
          color: #dc2626;
          background: rgba(220,38,38,0.09);
          box-shadow: inset 0 0 0 1px rgba(220,38,38,0.14);
        }
        .gm-activity-request-icon.is-empty {
          color: rgba(15,23,42,0.35);
          background: rgba(15,23,42,0.035);
          box-shadow: inset 0 0 0 1px rgba(15,23,42,0.055);
        }
        .gm-activity-request-icon-pair {
          width: 32px;
          grid-template-columns: 1fr 1fr;
          gap: 3px;
          background: transparent;
        }
        .gm-activity-request-icon-pair .gm-activity-request-icon {
          width: 15px;
          height: 15px;
        }
        .gm-activity-filter {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 4px;
          border-radius: 12px;
          background: rgba(255,255,255,0.78);
          box-shadow: inset 0 0 0 1px rgba(15,23,42,0.06), 0 2px 8px rgba(15,23,42,0.035);
        }
        .gm-activity-filter button {
          height: 28px;
          border: none;
          border-radius: 9px;
          padding: 0 9px;
          font: inherit;
          font-size: 10px;
          font-weight: 760;
          color: rgba(15,23,42,0.46);
          background: transparent;
          cursor: pointer;
        }
        .gm-activity-filter button.active {
          color: rgba(15,23,42,0.84);
          background: #fff;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.95), inset 0 -1px 0 rgba(15,23,42,0.035), 0 0 0 1px rgba(15,23,42,0.075), 0 1px 5px rgba(15,23,42,0.06);
        }
        .gm-activity-list {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 13px;
        }
        .gm-activity-card {
          border: 1px solid rgba(15,23,42,0.065);
          border-radius: 18px;
          padding: 15px;
          text-align: left;
          background: linear-gradient(180deg, rgba(255,255,255,0.96), rgba(255,255,255,0.9));
          box-shadow: 0 2px 8px rgba(15,23,42,0.04), 0 18px 42px rgba(15,23,42,0.045);
          cursor: pointer;
          font-family: inherit;
          transition: transform 0.16s ease, box-shadow 0.16s ease, border-color 0.16s ease;
        }
        .gm-activity-card:hover:not(:disabled) {
          transform: translateY(-1px);
          border-color: color-mix(in srgb, var(--gm-activity-accent) 24%, rgba(15,23,42,0.08));
          box-shadow: 0 4px 12px rgba(15,23,42,0.055), 0 22px 52px rgba(15,23,42,0.06);
        }
        .gm-activity-card:disabled {
          cursor: wait;
          opacity: 0.76;
        }
        .gm-activity-section-pill,
        .gm-activity-date-pill {
          height: 22px;
          display: inline-flex;
          align-items: center;
          padding: 0 8px;
          border-radius: 999px;
          font-size: 9px;
          font-weight: 820;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }
        .gm-activity-date-pill {
          background: rgba(15,23,42,0.045);
          color: rgba(15,23,42,0.42);
          box-shadow: inset 0 0 0 1px rgba(15,23,42,0.055);
        }
        .gm-activity-card-title {
          margin: 12px 0 0;
          font-size: 17px;
          line-height: 1.15;
          font-weight: 790;
          letter-spacing: -0.02em;
          color: rgba(15,23,42,0.94);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .gm-activity-card-sub,
        .gm-activity-campaign-line {
          display: flex;
          align-items: center;
          gap: 5px;
          margin-top: 6px;
          min-width: 0;
          font-size: 11px;
          line-height: 1.35;
          font-weight: 620;
          color: rgba(15,23,42,0.45);
        }
        .gm-activity-card-sub span,
        .gm-activity-campaign-line {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .gm-activity-campaign-line {
          color: rgba(15,23,42,0.55);
          display: block;
        }
        .gm-activity-card-metric {
          width: 72px;
          min-height: 58px;
          border-radius: 14px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 3px;
          background: rgba(15,23,42,0.035);
          box-shadow: inset 0 0 0 1px rgba(15,23,42,0.045);
          flex-shrink: 0;
        }
        .gm-activity-card-metric strong {
          font-size: 12px;
          font-weight: 780;
          color: rgba(15,23,42,0.8);
          white-space: nowrap;
        }
        .gm-activity-card-metric span {
          font-size: 8px;
          font-weight: 760;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: rgba(15,23,42,0.35);
        }
        .gm-activity-progress-row,
        .gm-activity-card-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .gm-activity-progress-row {
          margin-top: 15px;
          font-size: 10px;
          font-weight: 720;
          color: rgba(15,23,42,0.42);
        }
        .gm-activity-progress-track {
          margin-top: 7px;
          height: 7px;
          border-radius: 999px;
          overflow: hidden;
          background: rgba(15,23,42,0.055);
          box-shadow: inset 0 0 0 1px rgba(15,23,42,0.025);
        }
        .gm-activity-progress-track div {
          height: 100%;
          border-radius: inherit;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.28);
        }
        .gm-activity-card-footer {
          margin-top: 13px;
          padding-top: 12px;
          border-top: 1px solid rgba(15,23,42,0.055);
          font-size: 10px;
          font-weight: 770;
          color: rgba(15,23,42,0.55);
        }
        .gm-activity-card-footer span {
          display: inline-flex;
          align-items: center;
          gap: 5px;
        }
        .gm-activity-viewer-backdrop {
          position: fixed;
          inset: 0;
          z-index: 90;
          padding: 28px 18px 102px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(244,244,246,0.74);
          backdrop-filter: blur(18px);
        }
        .gm-activity-viewer {
          width: min(720px, 100%);
          max-height: min(820px, calc(100vh - 132px));
          overflow: auto;
          position: relative;
          border-radius: 24px;
          background: linear-gradient(180deg, rgba(255,255,255,0.98), rgba(255,255,255,0.94));
          box-shadow: 0 24px 70px rgba(15,23,42,0.18), inset 0 0 0 1px rgba(255,255,255,0.7);
          border: 1px solid rgba(15,23,42,0.08);
        }
        .gm-activity-viewer-header {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 18px;
          border-bottom: 1px solid rgba(15,23,42,0.055);
          position: sticky;
          top: 0;
          z-index: 2;
          background: rgba(255,255,255,0.92);
          backdrop-filter: blur(14px);
        }
        .gm-activity-icon-button {
          width: 34px;
          height: 34px;
          border: none;
          border-radius: 12px;
          background: rgba(15,23,42,0.045);
          color: rgba(15,23,42,0.56);
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          box-shadow: inset 0 0 0 1px rgba(15,23,42,0.055);
          flex-shrink: 0;
        }
        .gm-activity-viewer-eyebrow {
          margin-bottom: 5px;
          font-size: 9px;
          font-weight: 820;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: rgba(220,38,38,0.62);
        }
        .gm-activity-viewer-header h2 {
          margin: 0;
          font-size: 18px;
          line-height: 1.15;
          font-weight: 790;
          letter-spacing: -0.02em;
          color: rgba(15,23,42,0.94);
        }
        .gm-activity-viewer-header p {
          margin: 5px 0 0;
          font-size: 11px;
          font-weight: 610;
          color: rgba(15,23,42,0.44);
        }
        .gm-activity-viewer-strip {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr) auto;
          gap: 12px;
          align-items: center;
          padding: 14px 18px 0;
        }
        .gm-activity-viewer-strip span,
        .gm-activity-viewer-strip div:first-child span {
          font-size: 9px;
          font-weight: 820;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: rgba(15,23,42,0.34);
        }
        .gm-activity-viewer-strip strong {
          display: block;
          margin-top: 3px;
          font-size: 13px;
          font-weight: 780;
          color: rgba(15,23,42,0.82);
        }
        .gm-activity-viewer-progress {
          height: 8px;
          border-radius: 999px;
          overflow: hidden;
          background: rgba(15,23,42,0.06);
        }
        .gm-activity-viewer-progress div {
          height: 100%;
          border-radius: inherit;
        }
        .gm-activity-readonly-badge {
          height: 24px;
          display: inline-flex;
          align-items: center;
          padding: 0 9px;
          border-radius: 999px;
          background: rgba(5,150,105,0.08);
          color: #047857 !important;
          box-shadow: inset 0 0 0 1px rgba(5,150,105,0.14);
        }
        .gm-activity-question-card {
          margin: 14px 18px;
          padding: 18px;
          border-radius: 18px;
          background: rgba(255,255,255,0.94);
          border: 1px solid rgba(15,23,42,0.07);
          box-shadow: 0 2px 8px rgba(15,23,42,0.035);
        }
        .gm-activity-question-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-bottom: 12px;
        }
        .gm-activity-question-meta span {
          height: 22px;
          display: inline-flex;
          align-items: center;
          padding: 0 8px;
          border-radius: 999px;
          background: rgba(15,23,42,0.04);
          font-size: 9px;
          font-weight: 800;
          color: rgba(15,23,42,0.4);
        }
        .gm-activity-question-type-line {
          display: flex;
          align-items: center;
          gap: 7px;
          margin: -3px 0 12px;
          font-size: 9px;
          font-weight: 780;
          letter-spacing: 0.09em;
          text-transform: uppercase;
          color: rgba(15,23,42,0.36);
        }
        .gm-activity-question-type-line i {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: var(--gm-question-accent, #dc2626);
          opacity: 0.72;
          flex: 0 0 auto;
        }
        .gm-activity-question-type-line strong {
          font-size: 10px;
          font-weight: 820;
          letter-spacing: 0.055em;
          color: rgba(15,23,42,0.68);
        }
        .gm-activity-question-card h3 {
          margin: 0 0 16px;
          font-size: 18px;
          line-height: 1.35;
          font-weight: 760;
          letter-spacing: -0.015em;
          color: rgba(15,23,42,0.94);
        }
        .gm-activity-answer-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .gm-activity-answer-chips span {
          min-height: 32px;
          display: inline-flex;
          align-items: center;
          padding: 0 12px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 720;
          background: rgba(15,23,42,0.04);
        }
        .gm-activity-text-answer,
        .gm-activity-number-answer,
        .gm-activity-empty-answer {
          min-height: 42px;
          display: flex;
          align-items: center;
          border-radius: 13px;
          padding: 11px 13px;
          background: rgba(15,23,42,0.035);
          box-shadow: inset 0 0 0 1px rgba(15,23,42,0.055);
          font-size: 13px;
          font-weight: 650;
          line-height: 1.45;
          color: rgba(15,23,42,0.72);
        }
        .gm-activity-number-answer {
          font-size: 28px;
          font-weight: 780;
          color: rgba(15,23,42,0.88);
          font-variant-numeric: tabular-nums;
        }
        .gm-activity-empty-answer {
          color: rgba(15,23,42,0.38);
        }
        .gm-activity-photo-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(132px, 1fr));
          gap: 10px;
        }
        .gm-activity-photo {
          margin: 0;
          border-radius: 14px;
          overflow: hidden;
          background: rgba(15,23,42,0.035);
          box-shadow: inset 0 0 0 1px rgba(15,23,42,0.06);
        }
        .gm-activity-photo img,
        .gm-activity-photo-missing {
          display: block;
          width: 100%;
          aspect-ratio: 4 / 3;
          object-fit: cover;
        }
        .gm-activity-photo-missing {
          display: flex;
          align-items: center;
          justify-content: center;
          color: rgba(15,23,42,0.34);
        }
        .gm-activity-photo figcaption {
          padding: 8px 9px;
          font-size: 10px;
          font-weight: 680;
          color: rgba(15,23,42,0.52);
          line-height: 1.35;
        }
        .gm-activity-photo-editor {
          border-radius: 18px;
          padding: 14px;
          background: linear-gradient(180deg, rgba(255,255,255,0.92), rgba(248,250,252,0.88));
          box-shadow: inset 0 0 0 1px rgba(15,23,42,0.065), 0 10px 28px rgba(15,23,42,0.055);
        }
        .gm-activity-photo-editor-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 12px;
        }
        .gm-activity-photo-editor-head span {
          display: block;
          margin-bottom: 4px;
          font-size: 9px;
          font-weight: 820;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: rgba(15,23,42,0.34);
        }
        .gm-activity-photo-editor-head strong {
          display: block;
          font-size: 14px;
          line-height: 1.15;
          font-weight: 800;
          color: rgba(15,23,42,0.88);
        }
        .gm-activity-photo-editor-head > button,
        .gm-activity-photo-remove {
          border: none;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-family: inherit;
          cursor: pointer;
        }
        .gm-activity-photo-editor-head > button {
          width: 28px;
          height: 28px;
          border-radius: 10px;
          color: rgba(15,23,42,0.44);
          background: rgba(15,23,42,0.045);
          box-shadow: inset 0 0 0 1px rgba(15,23,42,0.055);
          flex-shrink: 0;
        }
        .gm-activity-photo-editor-upload {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          margin-bottom: 12px;
        }
        .gm-activity-photo-editor-upload button,
        .gm-activity-photo-editor-actions button,
        .gm-activity-photo-tag-mode button,
        .gm-activity-photo-tag-list button {
          font-family: inherit;
          cursor: pointer;
          border: none;
        }
        .gm-activity-photo-editor-upload button {
          height: 38px;
          border-radius: 12px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          font-size: 11px;
          font-weight: 800;
          color: rgba(15,23,42,0.64);
          background: rgba(255,255,255,0.82);
          box-shadow: inset 0 0 0 1px rgba(15,23,42,0.075), 0 1px 5px rgba(15,23,42,0.04);
        }
        .gm-activity-photo-editor-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(94px, 1fr));
          gap: 9px;
          margin-bottom: 12px;
        }
        .gm-activity-photo-editor-card {
          position: relative;
          border-radius: 14px;
          padding: 6px;
          background: rgba(255,255,255,0.78);
          box-shadow: inset 0 0 0 1px rgba(15,23,42,0.065), 0 1px 6px rgba(15,23,42,0.04);
        }
        .gm-activity-photo-editor-card.is-active {
          background: color-mix(in srgb, var(--photo-accent) 7%, #fff);
          box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--photo-accent) 34%, transparent), 0 5px 16px color-mix(in srgb, var(--photo-accent) 14%, transparent);
        }
        .gm-activity-photo-select {
          width: 100%;
          border: none;
          padding: 0;
          background: transparent;
          font-family: inherit;
          text-align: left;
          cursor: pointer;
        }
        .gm-activity-photo-thumb {
          height: 68px;
          border-radius: 10px;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          color: rgba(15,23,42,0.28);
          background: rgba(15,23,42,0.045);
        }
        .gm-activity-photo-thumb img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .gm-activity-photo-thumb-meta {
          margin-top: 7px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 6px;
        }
        .gm-activity-photo-thumb-meta strong {
          font-size: 10px;
          font-weight: 800;
          color: rgba(15,23,42,0.74);
        }
        .gm-activity-photo-thumb-meta em {
          font-style: normal;
          font-size: 9px;
          font-weight: 800;
          color: rgba(15,23,42,0.36);
        }
        .gm-activity-photo-remove {
          position: absolute;
          top: 6px;
          right: 6px;
          width: 22px;
          height: 22px;
          border-radius: 8px;
          color: rgba(15,23,42,0.52);
          background: rgba(255,255,255,0.88);
          box-shadow: 0 1px 6px rgba(15,23,42,0.10), inset 0 0 0 1px rgba(15,23,42,0.06);
        }
        .gm-activity-photo-editor-empty {
          margin-bottom: 12px;
          padding: 18px;
          border-radius: 14px;
          text-align: center;
          font-size: 11px;
          font-weight: 720;
          color: rgba(15,23,42,0.42);
          background: rgba(15,23,42,0.035);
          box-shadow: inset 0 0 0 1px rgba(15,23,42,0.05);
        }
        .gm-activity-photo-tag-panel {
          display: grid;
          gap: 10px;
        }
        .gm-activity-photo-tag-mode {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .gm-activity-photo-tag-mode button {
          height: 28px;
          padding: 0 10px;
          border-radius: 999px;
          font-size: 10px;
          font-weight: 820;
          color: rgba(15,23,42,0.46);
          background: rgba(15,23,42,0.045);
        }
        .gm-activity-photo-tag-mode button.active {
          color: rgba(15,23,42,0.86);
          background: #fff;
          box-shadow: inset 0 0 0 1px rgba(15,23,42,0.08), 0 1px 5px rgba(15,23,42,0.055);
        }
        .gm-activity-photo-tag-mode span {
          margin-left: auto;
          font-size: 9px;
          font-weight: 800;
          color: rgba(15,23,42,0.34);
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }
        .gm-activity-photo-tag-search {
          height: 36px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 0 11px;
          color: rgba(15,23,42,0.32);
          background: rgba(255,255,255,0.82);
          box-shadow: inset 0 0 0 1px rgba(15,23,42,0.075);
        }
        .gm-activity-photo-tag-search input {
          flex: 1;
          min-width: 0;
          border: none;
          outline: none;
          background: transparent;
          font: inherit;
          font-size: 11px;
          font-weight: 700;
          color: rgba(15,23,42,0.72);
        }
        .gm-activity-photo-tag-list {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
        }
        .gm-activity-photo-tag-list button {
          min-height: 30px;
          border-radius: 999px;
          padding: 0 11px;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 10px;
          font-weight: 760;
          color: rgba(15,23,42,0.58);
          background: rgba(255,255,255,0.86);
          box-shadow: inset 0 0 0 1px rgba(15,23,42,0.075), 0 1px 4px rgba(15,23,42,0.035);
        }
        .gm-activity-photo-tag-list button.selected {
          color: #fff;
          background: linear-gradient(180deg, #ef4444, #dc2626);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.24), inset 0 -1px 0 rgba(0,0,0,0.12), 0 0 0 1px rgba(185,28,28,0.78), 0 6px 14px rgba(220,38,38,0.16);
        }
        .gm-activity-photo-editor-actions {
          margin-top: 12px;
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 8px;
        }
        .gm-activity-photo-editor-actions button {
          height: 36px;
          border-radius: 11px;
          padding: 0 13px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          font-size: 11px;
          font-weight: 820;
        }
        .gm-activity-photo-editor-actions button:first-child {
          color: rgba(15,23,42,0.5);
          background: rgba(15,23,42,0.045);
          box-shadow: inset 0 0 0 1px rgba(15,23,42,0.055);
        }
        .gm-activity-photo-editor-actions button:last-child {
          color: #fff;
          background: linear-gradient(180deg, #16a34a 0%, #059669 52%, #047857 100%);
          box-shadow: inset 0 1px 0.8px rgba(255,255,255,0.34), inset 0 -1px 0 rgba(0,0,0,0.10), 0 0 0 1px rgba(4,120,87,0.72), 0 8px 18px rgba(5,150,105,0.16);
        }
        .gm-activity-photo-editor-actions button:disabled {
          opacity: 0.62;
          cursor: wait;
        }
        .gm-activity-matrix {
          overflow-x: auto;
          border-radius: 14px;
          box-shadow: inset 0 0 0 1px rgba(15,23,42,0.06);
        }
        .gm-activity-matrix-head,
        .gm-activity-matrix-row {
          display: grid;
          min-width: 420px;
        }
        .gm-activity-matrix-head span,
        .gm-activity-matrix-row span,
        .gm-activity-matrix-row strong {
          padding: 10px;
          border-bottom: 1px solid rgba(15,23,42,0.055);
          border-right: 1px solid rgba(15,23,42,0.055);
          font-size: 11px;
          font-weight: 650;
          color: rgba(15,23,42,0.62);
        }
        .gm-activity-matrix-head span {
          font-size: 9px;
          font-weight: 820;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: rgba(15,23,42,0.34);
          background: rgba(15,23,42,0.025);
        }
        .gm-activity-comment {
          margin-top: 14px;
          padding: 11px 12px;
          border-radius: 13px;
          background: rgba(220,38,38,0.045);
          color: rgba(120,20,20,0.68);
          font-size: 12px;
          font-weight: 650;
          line-height: 1.45;
        }
        .gm-activity-comment span {
          display: block;
          margin-bottom: 4px;
          font-size: 9px;
          font-weight: 820;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: rgba(220,38,38,0.56);
        }
        .gm-activity-request-entry {
          margin-top: 16px;
          display: grid;
          gap: 10px;
        }
        .gm-activity-request-open {
          width: fit-content;
          height: 36px;
          border: none;
          border-radius: 11px;
          padding: 0 14px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          font-family: inherit;
          font-size: 11px;
          font-weight: 800;
          color: #fff;
          background: linear-gradient(180deg, #16a34a 0%, #059669 52%, #047857 100%);
          box-shadow: inset 0 1px 0.8px rgba(255,255,255,0.34), inset 0 -1px 0 rgba(0,0,0,0.10), 0 0 0 1px rgba(4,120,87,0.72), 0 8px 18px rgba(5,150,105,0.16);
          cursor: pointer;
          transition: transform 0.15s ease, box-shadow 0.15s ease, filter 0.15s ease;
        }
        .gm-activity-request-open:hover {
          filter: saturate(1.04) brightness(1.02);
          box-shadow: inset 0 1px 0.8px rgba(255,255,255,0.38), inset 0 -1px 0 rgba(0,0,0,0.10), 0 0 0 1px rgba(4,120,87,0.78), 0 10px 22px rgba(5,150,105,0.20);
        }
        .gm-activity-request-open:active {
          transform: translateY(1px);
        }
        .gm-activity-delete-request-bar {
          margin: 12px 18px 0;
          border-radius: 15px;
          padding: 11px 12px;
          background: rgba(255,255,255,0.88);
          box-shadow: inset 0 0 0 1px rgba(15,23,42,0.065);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .gm-activity-delete-request-bar > div {
          min-width: 0;
          display: grid;
          gap: 2px;
        }
        .gm-activity-delete-request-bar strong {
          font-size: 11px;
          font-weight: 820;
          color: rgba(15,23,42,0.82);
        }
        .gm-activity-delete-request-bar span {
          font-size: 10px;
          line-height: 1.35;
          font-weight: 650;
          color: rgba(15,23,42,0.42);
        }
        .gm-activity-delete-request-open {
          height: 32px;
          border: 0;
          border-radius: 10px;
          padding: 0 11px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          flex: 0 0 auto;
          font-family: inherit;
          font-size: 10px;
          font-weight: 820;
          color: #fff;
          background: linear-gradient(180deg, #ef4444 0%, #dc2626 55%, #b91c1c 100%);
          box-shadow: inset 0 1px 0.8px rgba(255,255,255,0.34), inset 0 -1px 0 rgba(0,0,0,0.12), 0 0 0 1px rgba(185,28,28,0.72), 0 8px 18px rgba(220,38,38,0.15);
          cursor: pointer;
        }
        .gm-activity-delete-request-open:disabled {
          cursor: default;
          opacity: 0.78;
          box-shadow: inset 0 0 0 1px rgba(15,23,42,0.08);
        }
        .gm-activity-delete-request-open.is-pending {
          color: #92400e;
          background: rgba(245,158,11,0.12);
        }
        .gm-activity-delete-request-open.is-approved {
          color: #047857;
          background: rgba(5,150,105,0.10);
        }
        .gm-activity-delete-request-success {
          margin-top: 10px;
          border-radius: 12px;
          padding: 9px 11px;
          background: rgba(5,150,105,0.08);
          box-shadow: inset 0 0 0 1px rgba(5,150,105,0.14);
          color: #047857;
          font-size: 10px;
          font-weight: 780;
        }
        .gm-activity-request-modal.is-delete {
          background:
            linear-gradient(180deg, rgba(255,255,255,0.98), rgba(255,255,255,0.95)),
            radial-gradient(circle at 18% 0%, rgba(220,38,38,0.10), transparent 34%);
        }
        .gm-activity-request-mark.is-delete {
          background: linear-gradient(180deg, rgba(220,38,38,0.10), rgba(220,38,38,0.045));
          box-shadow: inset 0 0 0 1px rgba(220,38,38,0.14);
        }
        .gm-activity-delete-request-warning {
          border-radius: 14px;
          padding: 10px 11px;
          background: rgba(245,158,11,0.08);
          box-shadow: inset 0 0 0 1px rgba(245,158,11,0.16);
          display: grid;
          gap: 2px;
        }
        .gm-activity-delete-request-warning strong {
          font-size: 10px;
          font-weight: 840;
          color: #92400e;
        }
        .gm-activity-delete-request-warning span {
          font-size: 10px;
          line-height: 1.45;
          font-weight: 650;
          color: rgba(120,53,15,0.72);
        }
        .gm-activity-request-actions button.is-danger {
          color: #fff;
          background: linear-gradient(180deg, #ef4444 0%, #dc2626 55%, #b91c1c 100%);
          box-shadow: inset 0 1px 0.8px rgba(255,255,255,0.34), inset 0 -1px 0 rgba(0,0,0,0.12), 0 0 0 1px rgba(185,28,28,0.72), 0 8px 18px rgba(220,38,38,0.15);
        }
        .gm-activity-request-success {
          width: fit-content;
          min-height: 28px;
          display: inline-flex;
          align-items: center;
          border-radius: 10px;
          padding: 0 10px;
          background: rgba(5,150,105,0.08);
          color: #047857;
          box-shadow: inset 0 0 0 1px rgba(5,150,105,0.14);
          font-size: 10px;
          font-weight: 780;
        }
        .gm-activity-request-modal-backdrop {
          position: fixed;
          inset: 0;
          z-index: 130;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 18px;
          background: rgba(244,244,246,0.58);
          backdrop-filter: blur(16px);
        }
        .gm-activity-request-modal {
          width: min(448px, 100%);
          max-height: min(720px, calc(100vh - 42px));
          overflow: auto;
          border-radius: 22px;
          border: 1px solid rgba(15,23,42,0.08);
          background:
            linear-gradient(180deg, rgba(255,255,255,0.98), rgba(255,255,255,0.94)),
            radial-gradient(circle at 18% 0%, rgba(5,150,105,0.10), transparent 34%);
          box-shadow: 0 24px 70px rgba(15,23,42,0.18), 0 2px 8px rgba(15,23,42,0.06), inset 0 1px 0 rgba(255,255,255,0.8);
          padding: 16px;
          display: grid;
          gap: 13px;
        }
        .gm-activity-request-head {
          display: grid;
          grid-template-columns: 36px minmax(0, 1fr) 30px;
          align-items: flex-start;
          gap: 11px;
        }
        .gm-activity-request-mark {
          width: 36px;
          height: 36px;
          border-radius: 14px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(180deg, rgba(5,150,105,0.12), rgba(5,150,105,0.06));
          box-shadow: inset 0 0 0 1px rgba(5,150,105,0.14);
        }
        .gm-activity-request-mark span {
          width: 10px;
          height: 10px;
          border-radius: 999px;
          background: linear-gradient(180deg, #16a34a, #047857);
          box-shadow: 0 0 0 5px rgba(5,150,105,0.09);
        }
        .gm-activity-request-title span {
          display: block;
          margin-bottom: 4px;
          font-size: 9px;
          font-weight: 830;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: rgba(5,150,105,0.72);
        }
        .gm-activity-request-title strong {
          display: block;
          font-size: 17px;
          line-height: 1.25;
          font-weight: 790;
          letter-spacing: -0.02em;
          color: rgba(15,23,42,0.88);
        }
        .gm-activity-request-title p {
          margin: 6px 0 0;
          max-width: 320px;
          font-size: 11px;
          font-weight: 620;
          line-height: 1.45;
          color: rgba(15,23,42,0.46);
        }
        .gm-activity-request-head button {
          width: 28px;
          height: 28px;
          border: none;
          border-radius: 10px;
          background: rgba(15,23,42,0.045);
          color: rgba(15,23,42,0.48);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          flex-shrink: 0;
        }
        .gm-activity-request-current {
          display: grid;
          gap: 5px;
          border-radius: 15px;
          padding: 11px 12px;
          background: rgba(15,23,42,0.028);
          box-shadow: inset 0 0 0 1px rgba(15,23,42,0.055);
        }
        .gm-activity-request-current span,
        .gm-activity-request-field label {
          font-size: 9px;
          font-weight: 830;
          letter-spacing: 0.09em;
          text-transform: uppercase;
          color: rgba(15,23,42,0.34);
        }
        .gm-activity-request-current strong {
          font-size: 12px;
          line-height: 1.4;
          font-weight: 730;
          color: rgba(15,23,42,0.70);
        }
        .gm-activity-request-field {
          display: grid;
          gap: 8px;
        }
        .gm-activity-request-choice-list {
          display: grid;
          gap: 5px;
        }
        .gm-activity-request-choice {
          min-height: 38px;
          border: none;
          border-radius: 9px;
          padding: 9px 12px;
          display: flex;
          align-items: center;
          gap: 10px;
          background: rgba(15,23,42,0.035);
          color: rgba(15,23,42,0.62);
          font-family: inherit;
          font-size: 11px;
          font-weight: 620;
          text-align: left;
          cursor: pointer;
          transition: background 0.16s cubic-bezier(0.4,0,0.2,1), color 0.16s cubic-bezier(0.4,0,0.2,1), box-shadow 0.16s cubic-bezier(0.4,0,0.2,1);
        }
        .gm-activity-request-choice.selected {
          background: rgba(220,38,38,0.055);
          color: #DC2626;
          box-shadow: inset 0 0 0 1px rgba(220,38,38,0.24);
        }
        .gm-activity-request-choice-marker {
          width: 14px;
          height: 14px;
          flex: 0 0 14px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 1.5px solid rgba(15,23,42,0.16);
          color: #fff;
          background: transparent;
          transition: background 0.16s ease, border-color 0.16s ease;
        }
        .gm-activity-request-choice-marker.radio {
          border-radius: 999px;
        }
        .gm-activity-request-choice-marker.checkbox {
          border-radius: 4px;
        }
        .gm-activity-request-choice.selected .gm-activity-request-choice-marker {
          border-color: #DC2626;
          background: #DC2626;
        }
        .gm-activity-request-yn-row {
          display: flex;
          gap: 7px;
        }
        .gm-activity-request-yn-row button {
          flex: 1;
          height: 36px;
          border: none;
          border-radius: 10px;
          background: rgba(15,23,42,0.045);
          color: rgba(15,23,42,0.48);
          font-family: inherit;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.01em;
          cursor: pointer;
          transition: background 0.16s ease, color 0.16s ease, box-shadow 0.16s ease;
        }
        .gm-activity-request-yn-row button.selected {
          background: linear-gradient(to bottom, #DC2626, #b91c1c);
          color: #fff;
          box-shadow: inset 0 1px 0.6px rgba(255,255,255,0.33), inset 0 -1px 0 rgba(255,255,255,0.15), 0 0 0 1px #a91b1b, 0 2px 8px rgba(180,20,20,0.16);
        }
        .gm-activity-request-likert {
          display: grid;
          gap: 7px;
        }
        .gm-activity-request-likert-scale {
          display: flex;
          gap: 4px;
        }
        .gm-activity-request-likert-scale button {
          flex: 1;
          min-width: 34px;
          height: 36px;
          border: none;
          border-radius: 9px;
          background: rgba(15,23,42,0.045);
          color: rgba(15,23,42,0.50);
          font-family: inherit;
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
          transition: background 0.16s ease, color 0.16s ease, box-shadow 0.16s ease;
        }
        .gm-activity-request-likert-scale button.selected {
          background: linear-gradient(
            to bottom,
            hsl(var(--likert-hue) 78% 46%),
            hsl(var(--likert-hue) 78% 38%)
          );
          color: #fff;
          box-shadow: inset 0 1px 0.6px rgba(255,255,255,0.30), inset 0 -1px 0 rgba(0,0,0,0.08), 0 1px 6px rgba(15,23,42,0.12);
        }
        .gm-activity-request-likert-labels,
        .gm-activity-request-slider-values {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          font-size: 9.5px;
          font-weight: 680;
          color: rgba(15,23,42,0.36);
        }
        .gm-activity-request-ynm {
          display: grid;
          gap: 9px;
        }
        .gm-activity-request-subchoice-panel {
          display: grid;
          gap: 4px;
          overflow: hidden;
          border-radius: 12px;
          padding: 7px;
          background: rgba(15,23,42,0.025);
          box-shadow: inset 0 0 0 1px rgba(15,23,42,0.06);
        }
        .gm-activity-request-subchoice-head {
          min-height: 24px;
          padding: 0 4px 4px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          border-bottom: 1px solid rgba(15,23,42,0.045);
        }
        .gm-activity-request-subchoice-head span {
          font-size: 9px;
          font-weight: 820;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: rgba(15,23,42,0.36);
        }
        .gm-activity-request-subchoice-head strong {
          flex: 0 0 auto;
          border-radius: 999px;
          padding: 2px 7px;
          background: rgba(220,38,38,0.07);
          color: #DC2626;
          font-size: 9px;
          font-weight: 800;
        }
        .gm-activity-request-subchoice {
          min-height: 32px;
          border: none;
          border-radius: 8px;
          padding: 8px 9px;
          display: flex;
          align-items: center;
          gap: 9px;
          background: rgba(255,255,255,0.62);
          color: rgba(15,23,42,0.58);
          font-family: inherit;
          font-size: 10.5px;
          font-weight: 650;
          text-align: left;
          cursor: pointer;
        }
        .gm-activity-request-subchoice span {
          width: 13px;
          height: 13px;
          flex: 0 0 13px;
          border-radius: 4px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 1.5px solid rgba(15,23,42,0.14);
          color: #fff;
        }
        .gm-activity-request-subchoice.selected {
          background: rgba(220,38,38,0.05);
          color: #DC2626;
          box-shadow: inset 0 0 0 1px rgba(220,38,38,0.18);
        }
        .gm-activity-request-subchoice.selected span {
          border-color: #DC2626;
          background: #DC2626;
        }
        .gm-activity-request-number-card,
        .gm-activity-request-slider-card,
        .gm-activity-request-writing-card {
          border-radius: 13px;
          padding: 9px;
          background: rgba(15,23,42,0.025);
          box-shadow: inset 0 0 0 1px rgba(15,23,42,0.055);
        }
        .gm-activity-request-number-card .gm-activity-request-input {
          text-align: center;
          font-size: 14px;
          font-weight: 780;
        }
        .gm-activity-request-slider-card {
          display: grid;
          gap: 10px;
          padding: 12px;
        }
        .gm-activity-request-slider-values strong {
          color: #DC2626;
          font-size: 15px;
          font-weight: 820;
          letter-spacing: -0.02em;
        }
        .gm-activity-request-slider-track {
          position: relative;
          height: 20px;
          display: flex;
          align-items: center;
        }
        .gm-activity-request-slider-track::before,
        .gm-activity-request-slider-track > div {
          content: "";
          position: absolute;
          left: 0;
          height: 3px;
          border-radius: 999px;
        }
        .gm-activity-request-slider-track::before {
          right: 0;
          background: rgba(15,23,42,0.08);
        }
        .gm-activity-request-slider-track > div {
          background: linear-gradient(to right, #DC2626, #b91c1c);
        }
        .gm-activity-request-slider-track input {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 20px;
          margin: 0;
          opacity: 0;
          cursor: pointer;
        }
        .gm-activity-request-slider-track > span {
          position: absolute;
          width: 12px;
          height: 12px;
          border-radius: 999px;
          background: linear-gradient(to bottom, #DC2626, #b91c1c);
          box-shadow: 0 0 0 1px #a91b1b, 0 1px 5px rgba(180,20,20,0.24);
          pointer-events: none;
        }
        .gm-activity-request-photo-card {
          display: grid;
          gap: 8px;
        }
        .gm-activity-request-photo-card > div:first-child {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          color: rgba(15,23,42,0.48);
          font-size: 10px;
          font-weight: 780;
        }
        .gm-activity-request-matrix-card {
          display: grid;
          gap: 8px;
        }
        .gm-activity-request-matrix-preview {
          display: grid;
          grid-template-columns: 0.8fr 0.8fr 1fr;
          gap: 1px;
          overflow: hidden;
          border-radius: 10px;
          background: rgba(15,23,42,0.055);
        }
        .gm-activity-request-matrix-preview span {
          min-height: 28px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: rgba(255,255,255,0.74);
          color: rgba(15,23,42,0.38);
          font-size: 9px;
          font-weight: 810;
          letter-spacing: 0.07em;
          text-transform: uppercase;
        }
        .gm-activity-request-options,
        .gm-activity-request-suboptions {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
        }
        .gm-activity-request-options button {
          min-height: 32px;
          border: none;
          border-radius: 999px;
          padding: 0 12px;
          background: rgba(15,23,42,0.045);
          color: rgba(15,23,42,0.58);
          font-family: inherit;
          font-size: 11px;
          font-weight: 720;
          box-shadow: inset 0 0 0 1px rgba(15,23,42,0.055), 0 1px 2px rgba(15,23,42,0.025);
          cursor: pointer;
        }
        .gm-activity-request-options button.selected {
          background: color-mix(in srgb, var(--gm-request-accent) 10%, #fff);
          color: var(--gm-request-accent);
          box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--gm-request-accent) 25%, transparent);
        }
        .gm-activity-request-suboptions label {
          min-height: 30px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          border-radius: 999px;
          padding: 0 10px;
          background: rgba(15,23,42,0.035);
          color: rgba(15,23,42,0.58);
          font-size: 10px;
          font-weight: 700;
          box-shadow: inset 0 0 0 1px rgba(15,23,42,0.05);
        }
        .gm-activity-request-input,
        .gm-activity-request-textarea,
        .gm-activity-request-note {
          width: 100%;
          border: none;
          outline: none;
          border-radius: 13px;
          background: rgba(248,250,252,0.92);
          box-shadow: inset 0 0 0 1px rgba(15,23,42,0.06);
          font-family: inherit;
          font-size: 12px;
          font-weight: 650;
          color: rgba(15,23,42,0.76);
        }
        .gm-activity-request-input {
          height: 38px;
          padding: 0 12px;
        }
        .gm-activity-request-textarea,
        .gm-activity-request-note {
          min-height: 82px;
          padding: 11px 12px;
          resize: vertical;
          line-height: 1.45;
        }
        .gm-activity-request-note {
          min-height: 58px;
          background: rgba(248,250,252,0.72);
        }
        .gm-activity-request-error {
          font-size: 10px;
          font-weight: 760;
          color: #DC2626;
          line-height: 1.4;
        }
        .gm-activity-request-actions {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
        }
        .gm-activity-request-actions button {
          height: 34px;
          border: none;
          border-radius: 10px;
          padding: 0 12px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          font-family: inherit;
          font-size: 11px;
          font-weight: 760;
          cursor: pointer;
        }
        .gm-activity-request-actions button:first-child {
          background: rgba(15,23,42,0.045);
          color: rgba(15,23,42,0.48);
          box-shadow: inset 0 0 0 1px rgba(15,23,42,0.055);
        }
        .gm-activity-request-actions button:last-child {
          background: linear-gradient(180deg, #16a34a 0%, #059669 52%, #047857 100%);
          color: #fff;
          box-shadow: inset 0 1px 0.8px rgba(255,255,255,0.34), inset 0 -1px 0 rgba(0,0,0,0.10), 0 0 0 1px rgba(4,120,87,0.72), 0 8px 18px rgba(5,150,105,0.15);
        }
        .gm-activity-request-actions button:disabled {
          opacity: 0.62;
          cursor: not-allowed;
        }
        .gm-activity-viewer-footer {
          position: sticky;
          bottom: 0;
          display: grid;
          grid-template-columns: auto minmax(0, 1fr) auto;
          gap: 12px;
          align-items: center;
          padding: 13px 18px 18px;
          border-top: 1px solid rgba(15,23,42,0.055);
          background: rgba(255,255,255,0.93);
          backdrop-filter: blur(14px);
        }
        .gm-activity-bottom-navigator {
          position: absolute;
          left: 18px;
          right: 18px;
          bottom: 66px;
          z-index: 8;
          margin: 0;
          height: min(430px, calc(100vh - 260px));
          max-height: calc(100% - 140px);
          min-height: 250px;
          overflow: hidden;
          display: grid;
          grid-template-rows: auto auto minmax(0, 1fr);
          gap: 10px;
          padding: 12px;
          border-radius: 18px;
          background: rgba(255,255,255,0.97);
          box-shadow: 0 18px 50px rgba(15,23,42,0.16), inset 0 0 0 1px rgba(15,23,42,0.07);
          backdrop-filter: blur(18px);
        }
        .gm-activity-bottom-navigator-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .gm-activity-bottom-navigator-head span {
          display: block;
          font-size: 8px;
          font-weight: 820;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: rgba(15,23,42,0.36);
        }
        .gm-activity-bottom-navigator-head strong {
          display: block;
          margin-top: 2px;
          font-size: 13px;
          font-weight: 850;
          color: #111827;
        }
        .gm-activity-bottom-navigator-head button {
          width: 28px;
          height: 28px;
          border: none;
          border-radius: 10px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: rgba(15,23,42,0.54);
          background: rgba(15,23,42,0.045);
          box-shadow: inset 0 0 0 1px rgba(15,23,42,0.06);
          cursor: pointer;
        }
        .gm-activity-bottom-section-tabs {
          display: flex;
          gap: 7px;
          overflow-x: auto;
          scrollbar-width: none;
          -ms-overflow-style: none;
          padding-bottom: 1px;
        }
        .gm-activity-bottom-section-tabs::-webkit-scrollbar {
          display: none;
        }
        .gm-activity-bottom-section-tabs button {
          height: 30px;
          border: none;
          border-radius: 999px;
          padding: 0 10px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          flex: 0 0 auto;
          font-family: inherit;
          font-size: 10px;
          font-weight: 760;
          cursor: pointer;
        }
        .gm-activity-bottom-section-tabs i {
          width: 6px;
          height: 6px;
          border-radius: 999px;
          flex: 0 0 auto;
        }
        .gm-activity-bottom-section-tabs small {
          font-size: 9px;
          font-weight: 820;
          opacity: 0.62;
        }
        .gm-activity-bottom-module-list {
          min-height: 0;
          overflow-y: auto;
          overscroll-behavior: contain;
          -webkit-overflow-scrolling: touch;
          touch-action: pan-y;
          display: block;
          padding-right: 2px;
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .gm-activity-bottom-module-list::-webkit-scrollbar {
          display: none;
        }
        .gm-activity-bottom-module + .gm-activity-bottom-module {
          margin-top: 8px;
        }
        .gm-activity-bottom-module {
          border-radius: 14px;
          background: rgba(248,250,252,0.92);
          box-shadow: inset 0 0 0 1px rgba(15,23,42,0.055);
          overflow: hidden;
          padding: 6px;
        }
        .gm-activity-bottom-module-title {
          width: 100%;
          min-height: 40px;
          border: none;
          border-radius: 10px;
          padding: 8px 10px;
          display: grid;
          grid-template-columns: auto minmax(0, 1fr) auto;
          align-items: center;
          gap: 9px;
          font-family: inherit;
          text-align: left;
          color: #111827;
          cursor: pointer;
        }
        .gm-activity-bottom-module-title > span {
          min-width: 26px;
          height: 20px;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 9px;
          font-weight: 820;
          color: var(--gm-nav-accent);
          background: rgba(15,23,42,0.045);
        }
        .gm-activity-bottom-module-title > span.is-complete {
          color: #fff;
          background: var(--gm-nav-accent);
        }
        .gm-activity-bottom-module-title strong {
          min-width: 0;
          font-size: 11px;
          font-weight: 820;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .gm-activity-bottom-question-list {
          display: grid;
          gap: 4px;
          padding-top: 5px;
        }
        .gm-activity-bottom-question-list button {
          min-height: 34px;
          border: none;
          border-radius: 11px;
          padding: 7px 9px;
          display: grid;
          grid-template-columns: auto minmax(0, 1fr) auto;
          align-items: center;
          gap: 8px;
          font-family: inherit;
          text-align: left;
          color: #111827;
          background: transparent;
          cursor: pointer;
        }
        .gm-activity-bottom-question-list span {
          width: 18px;
          height: 18px;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 8px;
          font-weight: 820;
          color: rgba(15,23,42,0.48);
          background: rgba(15,23,42,0.055);
        }
        .gm-activity-bottom-question-list span.is-done {
          color: #fff;
          background: var(--gm-nav-accent);
        }
        .gm-activity-bottom-question-list p {
          min-width: 0;
          margin: 0;
          font-size: 10px;
          font-weight: 700;
          color: rgba(15,23,42,0.68);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .gm-activity-bottom-question-list i {
          width: 6px;
          height: 6px;
          border-radius: 999px;
        }
        .gm-activity-viewer-footer > button:not(.gm-activity-footer-navigator) {
          height: 34px;
          border: none;
          border-radius: 10px;
          padding: 0 12px;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-family: inherit;
          font-size: 11px;
          font-weight: 760;
          color: #fff;
          background: linear-gradient(to bottom, #DC2626, #b91c1c);
          box-shadow: inset 0 1px 0.6px rgba(255,255,255,0.33), inset 0 -1px 0 rgba(255,255,255,0.15), 0 0 0 1px #a91b1b, 0 1px 6px rgba(180,20,20,0.14);
          cursor: pointer;
        }
        .gm-activity-viewer-footer > button:not(.gm-activity-footer-navigator):disabled {
          background: rgba(15,23,42,0.08);
          box-shadow: inset 0 0 0 1px rgba(15,23,42,0.05);
          color: rgba(15,23,42,0.28);
          cursor: not-allowed;
        }
        .gm-activity-footer-navigator {
          min-width: 0;
          height: 40px;
          border: none;
          border-radius: 13px;
          padding: 6px 12px;
          display: grid;
          grid-template-columns: auto minmax(0, 1fr);
          grid-template-rows: auto auto;
          align-items: center;
          column-gap: 9px;
          row-gap: 4px;
          font-family: inherit;
          background: rgba(15,23,42,0.035);
          color: rgba(15,23,42,0.58);
          box-shadow: inset 0 0 0 1px rgba(15,23,42,0.06);
          cursor: pointer;
          transition: background 0.16s ease, box-shadow 0.16s ease, transform 0.16s ease;
        }
        .gm-activity-footer-navigator:hover {
          background: rgba(15,23,42,0.05);
          box-shadow: inset 0 0 0 1px rgba(15,23,42,0.09);
          transform: translateY(-1px);
        }
        .gm-activity-footer-navigator > span {
          min-width: 0;
          font-size: 8px;
          font-weight: 820;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: rgba(15,23,42,0.42);
          white-space: nowrap;
        }
        .gm-activity-footer-navigator > strong {
          min-width: 0;
          font-size: 11px;
          font-weight: 820;
          color: #111827;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .gm-activity-footer-navigator .gm-activity-dot-row {
          grid-column: 1 / -1;
          padding: 0;
        }
        .gm-activity-dot-row {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 5px;
          overflow-x: auto;
          scrollbar-width: none;
          -ms-overflow-style: none;
          padding: 3px 0;
        }
        .gm-activity-dot-row::-webkit-scrollbar {
          display: none;
        }
        .gm-activity-dot-row i,
        .gm-activity-dot-row button {
          width: 6px;
          height: 6px;
          border: none;
          border-radius: 999px;
          padding: 0;
          flex: 0 0 auto;
          cursor: pointer;
          transition: transform 0.16s ease, background 0.16s ease;
        }
        .gm-activity-history-backdrop {
          position: fixed;
          inset: 0;
          z-index: 128;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 18px;
          background: rgba(244,244,246,0.56);
          backdrop-filter: blur(16px);
        }
        .gm-activity-history-modal {
          width: min(660px, 100%);
          max-height: min(760px, calc(100vh - 44px));
          border-radius: 24px;
          border: 1px solid rgba(15,23,42,0.075);
          background:
            radial-gradient(circle at 18% 0%, rgba(220,38,38,0.07), transparent 30%),
            linear-gradient(180deg, rgba(255,255,255,0.98), rgba(255,255,255,0.94));
          box-shadow: 0 28px 80px rgba(15,23,42,0.18), 0 2px 8px rgba(15,23,42,0.055), inset 0 1px 0 rgba(255,255,255,0.86);
          padding: 16px;
          display: grid;
          grid-template-rows: auto auto minmax(0, 1fr);
          gap: 13px;
          overflow: hidden;
        }
        .gm-activity-history-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          padding: 4px 2px 0;
        }
        .gm-activity-history-head span {
          display: block;
          margin-bottom: 4px;
          font-size: 9px;
          font-weight: 830;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: rgba(220,38,38,0.58);
        }
        .gm-activity-history-head h2 {
          margin: 0;
          font-size: 22px;
          line-height: 1.05;
          font-weight: 790;
          letter-spacing: -0.03em;
          color: rgba(15,23,42,0.93);
        }
        .gm-activity-history-head p {
          margin: 6px 0 0;
          max-width: 430px;
          font-size: 11px;
          line-height: 1.45;
          font-weight: 590;
          color: rgba(15,23,42,0.46);
        }
        .gm-activity-history-actions {
          display: inline-flex;
          gap: 7px;
        }
        .gm-activity-history-actions button {
          width: 30px;
          height: 30px;
          border: 0;
          border-radius: 11px;
          background: rgba(255,255,255,0.9);
          color: rgba(15,23,42,0.48);
          box-shadow: inset 0 0 0 1px rgba(15,23,42,0.065), 0 2px 6px rgba(15,23,42,0.045);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }
        .gm-activity-history-actions button:disabled {
          opacity: 0.55;
          cursor: wait;
        }
        .gm-activity-history-error {
          min-height: 34px;
          border-radius: 12px;
          padding: 10px 12px;
          background: rgba(255,245,245,0.94);
          box-shadow: inset 0 0 0 1px rgba(220,38,38,0.18);
          color: #dc2626;
          font-size: 10px;
          font-weight: 760;
        }
        .gm-activity-history-list {
          min-height: 0;
          overflow: auto;
          display: grid;
          gap: 10px;
          padding: 1px 2px 2px;
          scrollbar-width: none;
        }
        .gm-activity-history-list::-webkit-scrollbar {
          display: none;
        }
        .gm-activity-history-empty {
          min-height: 238px;
          border-radius: 18px;
          display: grid;
          place-items: center;
          align-content: center;
          gap: 7px;
          background: rgba(15,23,42,0.025);
          color: rgba(15,23,42,0.38);
          box-shadow: inset 0 0 0 1px rgba(15,23,42,0.055);
          text-align: center;
        }
        .gm-activity-history-empty strong {
          font-size: 13px;
          font-weight: 790;
          color: rgba(15,23,42,0.62);
        }
        .gm-activity-history-empty span {
          max-width: 260px;
          font-size: 11px;
          font-weight: 570;
          line-height: 1.45;
        }
        .gm-activity-history-skeleton {
          height: 112px;
          border-radius: 17px;
        }
        .gm-activity-history-group {
          border-radius: 18px;
          padding: 12px;
          background: rgba(255,255,255,0.78);
          box-shadow: inset 0 0 0 1px rgba(15,23,42,0.065), 0 2px 8px rgba(15,23,42,0.035);
          display: grid;
          gap: 10px;
        }
        .gm-activity-history-group-head {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr) auto;
          align-items: center;
          gap: 10px;
        }
        .gm-activity-history-group-head strong {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 13px;
          font-weight: 800;
          letter-spacing: -0.01em;
          color: rgba(15,23,42,0.82);
        }
        .gm-activity-history-group-head span,
        .gm-activity-history-group-head small {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 10px;
          font-weight: 650;
          color: rgba(15,23,42,0.4);
        }
        .gm-activity-history-status-line {
          display: flex;
          align-items: center;
          gap: 8px;
          color: rgba(15,23,42,0.42);
          font-size: 9px;
          font-weight: 780;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }
        .gm-activity-history-status-line i {
          height: 1px;
          flex: 1;
          background: linear-gradient(90deg, color-mix(in srgb, var(--gm-history-accent) 24%, transparent), rgba(15,23,42,0.055));
        }
        .gm-activity-history-items {
          display: grid;
          gap: 7px;
        }
        .gm-activity-history-item {
          border-radius: 14px;
          padding: 10px;
          background: rgba(15,23,42,0.024);
          box-shadow: inset 0 0 0 1px rgba(15,23,42,0.045);
          display: grid;
          gap: 7px;
        }
        .gm-activity-history-item.is-delete {
          background: rgba(220,38,38,0.035);
          box-shadow: inset 0 0 0 1px rgba(220,38,38,0.08);
        }
        .gm-activity-history-item-top {
          display: flex;
          align-items: center;
          gap: 7px;
          color: rgba(15,23,42,0.38);
          font-size: 9px;
          font-weight: 760;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }
        .gm-activity-history-item-top small {
          margin-left: auto;
          font-size: 9px;
          font-weight: 680;
          letter-spacing: 0;
          text-transform: none;
          color: rgba(15,23,42,0.36);
        }
        .gm-activity-history-item > strong {
          font-size: 12px;
          line-height: 1.35;
          font-weight: 760;
          color: rgba(15,23,42,0.78);
        }
        .gm-activity-history-diff {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
          align-items: center;
          gap: 7px;
          font-size: 10px;
          line-height: 1.35;
          color: rgba(15,23,42,0.44);
        }
        .gm-activity-history-diff span,
        .gm-activity-history-diff b {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .gm-activity-history-diff b {
          color: rgba(15,23,42,0.78);
          font-weight: 790;
        }
        .gm-activity-history-item p {
          margin: 0;
          border-radius: 10px;
          padding: 8px 9px;
          background: rgba(255,255,255,0.58);
          color: rgba(15,23,42,0.48);
          font-size: 10px;
          line-height: 1.45;
          font-weight: 590;
        }
        .gm-activity-history-admin-note {
          box-shadow: inset 0 0 0 1px rgba(15,23,42,0.055);
        }
        @media (max-width: 840px) {
          .gm-activity-stat-grid,
          .gm-activity-list {
            grid-template-columns: 1fr;
          }
          .gm-activity-toolbar {
            grid-template-columns: 1fr;
          }
          .gm-activity-filter {
            overflow-x: auto;
          }
        }
        @media (max-width: 560px) {
          .gm-activity-page {
            padding-bottom: 104px;
          }
          .gm-activity-viewer-backdrop {
            align-items: stretch;
            padding: 10px 8px 94px;
          }
          .gm-activity-viewer {
            max-height: calc(100vh - 104px);
            border-radius: 20px;
          }
          .gm-activity-viewer-strip {
            grid-template-columns: 1fr;
          }
          .gm-activity-viewer-footer {
            grid-template-columns: auto minmax(0, 1fr) auto;
            gap: 8px;
            padding: 10px 10px 14px;
          }
          .gm-activity-viewer-footer > button:not(.gm-activity-footer-navigator) {
            min-width: 0;
            padding: 0 9px;
          }
          .gm-activity-bottom-navigator {
            left: 10px;
            right: 10px;
            bottom: 58px;
            margin: 0;
            height: min(390px, calc(100vh - 218px));
            max-height: calc(100% - 116px);
            min-height: 236px;
          }
          .gm-activity-bottom-module-list {
            max-height: none;
          }
        }
      `}</style>

      <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: 420, pointerEvents: "none", zIndex: 0, opacity: 0.35 }}>
        <Aurora colorStops={["#F4B4B4", "#DC2626", "#F4B4B4"]} blend={0.6} amplitude={0.8} speed={0.3} />
      </div>

      <div className="mx-auto px-6 pt-6 lg:px-10 lg:pt-8" style={{ maxWidth: 960, position: "relative", zIndex: 1 }}>
        <header style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(220,38,38,0.62)", marginBottom: 5 }}>
              Aktivität
            </div>
            <h1 style={{ margin: 0, fontSize: 28, lineHeight: 1.05, fontWeight: 780, letterSpacing: "-0.03em", color: "rgba(15,23,42,0.94)" }}>
              Abgeschlossene Fragebögen
            </h1>
            <p style={{ margin: "8px 0 0", maxWidth: 520, fontSize: 12, lineHeight: 1.55, fontWeight: 560, color: "rgba(15,23,42,0.48)" }}>
              Deine fertigen Marktbesuche als sichere Read-only Ansicht. Keine neue Session, keine Änderungen.
            </p>
          </div>
          <span style={{ height: 30, display: "inline-flex", alignItems: "center", gap: 7, padding: "0 11px", borderRadius: 999, background: "#fff", boxShadow: "0 1px 5px rgba(15,23,42,0.06), inset 0 0 0 1px rgba(15,23,42,0.06)", fontSize: 10, fontWeight: 760, color: "rgba(15,23,42,0.48)", whiteSpace: "nowrap" }}>
            <ClipboardCheck size={13} strokeWidth={2.1} />
            {visits.length} erledigt
          </span>
        </header>

        <section className="gm-activity-stat-grid">
          <StatTile label="Fragebögen" value={String(visits.length)} sub="Abgeschlossen und gespeichert" icon={ClipboardCheck} color={R} />
          <StatTile label="Fragen" value={String(stats.questionCount)} sub="Aus gespeicherten Besuchen" icon={FileText} color="#2563eb" />
          <StatTile label="Fotos" value={String(stats.photoCount)} sub="In Foto-Fragen abgelegt" icon={Camera} color="#0891b2" />
          <StatTile label="Ø Dauer" value={fmtDuration(stats.avgDuration)} sub="Durchschnitt pro Besuch" icon={Clock} color={GREEN} />
        </section>

        <div className="gm-activity-toolbar">
          <label className="gm-activity-search">
            <Search size={14} strokeWidth={2} color="rgba(15,23,42,0.36)" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Markt, Adresse oder Kampagne suchen..."
            />
          </label>
          <button type="button" className="gm-activity-request-status-card" onClick={() => setHistoryOpen(true)}>
            <RequestStatusIcon status={featuredRequestStatus} />
            <span className="gm-activity-request-status-text">
              <strong>{featuredRequestTitle}</strong>
              <span>{featuredRequestSubtitle}</span>
            </span>
          </button>
          <div className="gm-activity-filter">
            {sectionOptions.map((option) => (
              <button
                key={option}
                type="button"
                className={sectionFilter === option ? "active" : ""}
                onClick={() => setSectionFilter(option)}
              >
                {option === "all" ? "Alle" : sectionLabel(option)}
              </button>
            ))}
          </div>
        </div>

        {error ? (
          <CardShell style={{ padding: 14, marginBottom: 14, borderColor: "rgba(220,38,38,0.18)", background: "rgba(255,245,245,0.92)" }}>
            <div style={{ fontSize: 11, fontWeight: 760, color: R }}>{error}</div>
          </CardShell>
        ) : null}

        {loading ? (
          <ActivitySkeleton />
        ) : filteredVisits.length > 0 ? (
          <section className="gm-activity-list">
            {filteredVisits.map((visit) => (
              <VisitCard key={visit.id} visit={visit} onOpen={openVisit} isOpening={openingId === visit.id} />
            ))}
          </section>
        ) : (
          <CardShell style={{ padding: "34px 18px", textAlign: "center" }}>
            <Store size={24} strokeWidth={1.9} color="rgba(15,23,42,0.22)" />
            <div style={{ marginTop: 10, fontSize: 13, fontWeight: 780, color: "rgba(15,23,42,0.72)" }}>
              Keine abgeschlossenen Fragebögen gefunden
            </div>
            <p style={{ margin: "6px auto 0", maxWidth: 360, fontSize: 11, lineHeight: 1.5, fontWeight: 560, color: "rgba(15,23,42,0.42)" }}>
              Sobald du einen Marktbesuch beendest, erscheint er hier als Read-only Ansicht.
            </p>
          </CardShell>
        )}
      </div>

      <div className="fixed bottom-6 left-0 right-0 z-50">
        <CollapsibleMenu
          items={GM_MENU_ITEMS}
          defaultIndex={1}
          onSelect={(_index, item) => {
            if (item.action === "logout") {
              logoutCurrentUser();
              if (typeof window !== "undefined") {
                window.location.assign("/");
                return;
              }
              router.replace("/");
              router.refresh();
              return;
            }
            if (item.href) router.push(item.href);
          }}
        />
      </div>

      {viewerPayload ? (
        <ReadOnlyVisitViewer
          payload={viewerPayload}
          onClose={() => setViewerPayload(null)}
          onPayloadUpdated={setViewerPayload}
          onChangeRequestSubmitted={() => void loadChangeRequests()}
          deleteRequest={deleteRequestBySessionId.get(viewerPayload.session.id) ?? null}
          onDeleteRequestSubmitted={() => void loadChangeRequests()}
        />
      ) : null}

      {historyOpen ? (
        <ChangeRequestHistoryModal
          groups={requestGroups}
          loading={changeRequestsLoading}
          error={changeRequestsError}
          onClose={() => setHistoryOpen(false)}
          onRefresh={() => void loadChangeRequests()}
        />
      ) : null}
    </main>
  );
}
