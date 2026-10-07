"use client";

import { CalendarDays, Clock3, LoaderCircle, MapPin, RefreshCw, Store, X } from "lucide-react";
import { useState, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { SmPlanningStatus } from "@/types/smPlanning";
import type { SmHolidayAdjustment } from "@/lib/sm/austrianHolidays";
import { isSMDurcharbeitAssignment } from "@/lib/sm/SMDurcharbeitView";
import { SmHolidayNote } from "@/components/sm/SmHolidayNote";

export interface DashboardAssignment {
  SMDurcharbeitMarket?: boolean;
  SMDurcharbeitQuestionnaireSelection?: import("@/types/smSMDurcharbeit").SMDurcharbeitQuestionnaireSelection;
  SMDurcharbeitUpdatedAt?: string;
  holidayAdjustment?: SmHolidayAdjustment | null;
  id: string;
  duration: string;
  market: string;
  address: string;
  workDate: string;
  marketInternalId: string;
  region: string;
  sourceType: "single" | "series";
  status: SmPlanningStatus;
}

interface AssignmentListProps {
  assignments: DashboardAssignment[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onStart?: (assignment: DashboardAssignment) => void;
  startingAssignmentId?: string | null;
}

export function AssignmentList({
  assignments,
  loading = false,
  error = null,
  onRetry,
  onStart,
  startingAssignmentId = null,
}: AssignmentListProps) {
  const [selectedAssignment, setSelectedAssignment] = useState<DashboardAssignment | null>(null);

  const openDetailsFromKeyboard = (event: KeyboardEvent<HTMLDivElement>, assignment: DashboardAssignment) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    setSelectedAssignment(assignment);
  };

  return (
    <section aria-label="Besuche">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2"><CalendarDays size={12} className="text-gray-400" /><h3 className="text-[11px] font-semibold text-gray-600">Besuche</h3></div>
        {loading ? <span aria-hidden="true" className="h-2.5 w-12 motion-safe:animate-pulse rounded bg-black/[.04]" /> : !error ? <span className="text-[9px] tabular-nums text-gray-400">{assignments.length} {assignments.length === 1 ? "Einsatz" : "Einsätze"}</span> : null}
      </div>
      <div className="flex items-center px-1 pb-2">
        <span className="w-[68px] text-[10px] font-semibold uppercase tracking-[0.04em] text-gray-300">
          Dauer
        </span>
        <span className="flex-1 text-[10px] font-semibold uppercase tracking-[0.04em] text-gray-300">
          Markt
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.04em] text-gray-300">
          Status
        </span>
      </div>

      <div
        className="w-full"
        style={{ height: 1, backgroundColor: "rgba(0,0,0,0.06)" }}
      />

      <div
        className="h-[132px] overflow-y-auto overscroll-contain [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {loading && assignments.length === 0 ? (
          <div className="space-y-2 py-3" aria-label="Einsätze werden geladen">
            {[0, 1, 2].map((key) => (
              <div key={key} className="h-8 animate-pulse rounded-lg bg-black/[0.035]" />
            ))}
          </div>
        ) : null}

        {!loading && error ? (
          <div className="flex items-center justify-between gap-3 py-4">
            <p role="alert" className="text-[10px] text-red-700">{error}</p>
            {onRetry ? (
              <button type="button" onClick={onRetry} className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-black/10 bg-white px-2.5 py-1.5 text-[9px] font-semibold text-gray-600">
                <RefreshCw size={9} /> Erneut laden
              </button>
            ) : null}
          </div>
        ) : null}

        {!loading && !error && assignments.length === 0 ? (
          <div className="flex min-h-[132px] flex-col items-center justify-center px-5 text-center">
            <span
              className="flex h-9 w-9 items-center justify-center rounded-xl"
              style={{ background: "rgba(220,38,38,0.055)", color: "rgba(220,38,38,0.42)" }}
            >
              <CalendarDays size={15} strokeWidth={1.65} />
            </span>
            <p className="mt-3 text-[10px] font-semibold text-gray-500">Keine Besuche für diesen Tag</p>
            <p className="mt-1 text-[9px] leading-relaxed text-gray-300">Wähle unten einen anderen Tag aus.</p>
          </div>
        ) : null}

        {assignments.map((a, i) => {
          const SMDurcharbeit = isSMDurcharbeitAssignment(a);
          return (
          <div
            key={a.id}
            role="button"
            tabIndex={0}
            aria-label={`Details zu ${a.market} öffnen`}
            onClick={() => setSelectedAssignment(a)}
            onKeyDown={(event) => openDetailsFromKeyboard(event, a)}
            className={`flex ${a.holidayAdjustment ? "min-h-[58px]" : "h-[44px]"} cursor-pointer items-center px-1 outline-none transition-colors hover:bg-black/[0.018] focus-visible:bg-black/[0.025]`}
            style={{
              ...(SMDurcharbeit ? { background: "rgba(37,99,235,.025)" } : {}),
              borderBottom:
                i < assignments.length - 1
                  ? "1px solid rgba(0,0,0,0.04)"
                  : "none",
            }}
          >
            <span className={`w-[68px] shrink-0 whitespace-nowrap text-[10px] tabular-nums ${SMDurcharbeit ? "font-medium text-blue-500" : "text-gray-400"}`}>
              {a.duration}
            </span>
            <span className="min-w-0 flex-1 pr-2">
              <span className={`block truncate text-[12px] font-medium ${SMDurcharbeit ? "text-blue-950" : "text-gray-800"}`}>{a.market}</span>
              {a.holidayAdjustment ? <SmHolidayNote compact adjustment={a.holidayAdjustment} currentDate={a.workDate} /> : null}
              {a.address ? (
                <a
                  href={googleMapsUrl(a)}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`${a.market} in Google Maps öffnen`}
                  onClick={(event) => event.stopPropagation()}
                  className={`mt-0.5 inline-block max-w-full truncate align-top text-[9px] hover:underline ${SMDurcharbeit ? "text-blue-400 hover:text-blue-600" : "text-gray-400 hover:text-red-600"}`}
                >
                  {SMDurcharbeit ? "Durcharbeit · " : ""}{a.address}
                </a>
              ) : SMDurcharbeit ? <span className="mt-0.5 block text-[9px] text-blue-400">Durcharbeit</span> : null}
            </span>
            <StatusPill SMDurcharbeit={SMDurcharbeit} assignment={a} onStart={onStart} starting={startingAssignmentId === a.id} launchLocked={startingAssignmentId !== null} />
          </div>
          );
        })}
      </div>

      {selectedAssignment && typeof document !== "undefined" ? createPortal(
        <AssignmentDetailDialog assignment={selectedAssignment} onClose={() => setSelectedAssignment(null)} />,
        document.body,
      ) : null}
    </section>
  );
}

function googleMapsUrl(assignment: Pick<DashboardAssignment, "market" | "address">): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${assignment.market}, ${assignment.address}`)}`;
}

function formatWorkDate(value: string): string {
  return new Intl.DateTimeFormat("de-AT", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

function AssignmentDetailDialog({ assignment, onClose }: { assignment: DashboardAssignment; onClose: () => void }) {
  const status = STATUS_META[assignment.status];
  const SMDurcharbeit = isSMDurcharbeitAssignment(assignment);
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/25 px-4 py-6 backdrop-blur-[1px]"
      role="presentation"
      onClick={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="sm-assignment-detail-title"
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-[380px] overflow-hidden rounded-2xl bg-white shadow-[0_18px_55px_rgba(0,0,0,0.18)]"
      >
        <header className="flex items-start justify-between gap-4 border-b border-black/[0.055] px-5 py-4">
          <div className="min-w-0">
            <p className={`text-[10px] font-semibold uppercase tracking-[0.08em] ${SMDurcharbeit ? "text-blue-600" : "text-red-500/65"}`}>{SMDurcharbeit ? "Durcharbeit · Einsatzdetails" : "Einsatzdetails"}</p>
            <h2 id="sm-assignment-detail-title" className="mt-1 truncate text-[16px] font-semibold text-gray-900">{assignment.market}</h2>
            <p className="mt-1 text-[11px] text-gray-400">Stammnr. {assignment.marketInternalId}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Details schließen" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-black/[0.035] text-gray-500">
            <X size={14} />
          </button>
        </header>

        <div className="grid gap-3 px-5 py-4">
          {assignment.holidayAdjustment ? <SmHolidayNote adjustment={assignment.holidayAdjustment} currentDate={assignment.workDate} /> : null}
          {assignment.SMDurcharbeitQuestionnaireSelection ? <div><p className={`text-[11px] font-medium ${SMDurcharbeit ? "text-blue-800" : "text-gray-600"}`}>{assignment.SMDurcharbeitQuestionnaireSelection.name} · Version {assignment.SMDurcharbeitQuestionnaireSelection.versionNumber ?? "—"}</p>{assignment.SMDurcharbeitQuestionnaireSelection.blockReason ? <p className="mt-2 text-[10px] text-amber-700">{assignment.SMDurcharbeitQuestionnaireSelection.blockReason}</p> : null}</div> : null}
          <DetailRow SMDurcharbeit={SMDurcharbeit} icon={<CalendarDays size={15} />} label="Datum" value={formatWorkDate(assignment.workDate)} />
          <DetailRow SMDurcharbeit={SMDurcharbeit} icon={<Clock3 size={15} />} label="Sollzeit" value={assignment.duration} />
          <DetailRow SMDurcharbeit={SMDurcharbeit} icon={<Store size={15} />} label="Planung" value={`${assignment.sourceType === "series" ? "Serie" : "Einmalig"} · ${status.label}`} />
          <DetailRow SMDurcharbeit={SMDurcharbeit} icon={<MapPin size={15} />} label="Adresse" value={assignment.address || "Keine Adresse hinterlegt"} />
        </div>

        <div className="px-5 pb-5">
          <a
            href={googleMapsUrl(assignment)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl text-[12px] font-semibold text-white"
            style={{ background: SMDurcharbeit ? "linear-gradient(#2563EB,#1D4ED8)" : "linear-gradient(to bottom,#DC2626,#c42020)", boxShadow: "inset 0 1px .6px rgba(255,255,255,.35),0 1px 6px rgba(180,20,20,.18)" }}
          >
            <MapPin size={14} /> In Google Maps öffnen
          </a>
        </div>
      </section>
    </div>
  );
}

function DetailRow({ icon, label, value, SMDurcharbeit = false }: { icon: ReactNode; label: string; value: string; SMDurcharbeit?: boolean }) {
  return (
    <div className="flex items-start gap-3 rounded-xl bg-black/[0.025] px-3.5 py-3">
      <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white ${SMDurcharbeit ? "text-blue-500" : "text-red-500"} shadow-[0_0_0_1px_rgba(0,0,0,0.05)]`}>{icon}</span>
      <span className="min-w-0">
        <span className="block text-[9px] font-semibold uppercase tracking-[0.07em] text-gray-400">{label}</span>
        <span className="mt-1 block text-[13px] font-medium leading-snug text-gray-800">{value}</span>
      </span>
    </div>
  );
}

const STATUS_META: Record<SmPlanningStatus, { label: string; background: string; color: string }> = {
  planned: { label: "Starten", background: "linear-gradient(to bottom, #DC2626, #e84040)", color: "#fff" },
  confirmed: { label: "Starten", background: "linear-gradient(to bottom, #DC2626, #e84040)", color: "#fff" },
  open: { label: "Starten", background: "linear-gradient(to bottom, #DC2626, #e84040)", color: "#fff" },
  in_progress: { label: "Fortsetzen", background: "#FFF7E8", color: "#B45309" },
  completed: { label: "Erledigt", background: "#ECFDF3", color: "#15803D" },
  cancelled: { label: "Abgesagt", background: "#FEF2F2", color: "#B91C1C" },
  missed: { label: "Versäumt", background: "#F3F4F6", color: "#6B7280" },
};

function StatusPill({ assignment, onStart, starting, launchLocked, SMDurcharbeit = false }: { SMDurcharbeit?: boolean; assignment: DashboardAssignment; onStart?: (assignment: DashboardAssignment) => void; starting: boolean; launchLocked: boolean }) {
  const meta = STATUS_META[assignment.status];
  const actionable = ["planned", "confirmed", "open", "in_progress"].includes(assignment.status);

  return (
    <button
      type="button"
      disabled={!actionable || launchLocked}
      aria-label={actionable ? `${assignment.market}: ${meta.label}` : meta.label}
      onClick={(event: MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        if (actionable && !launchLocked) onStart?.(assignment);
      }}
      className="inline-flex items-center justify-center text-[10px] font-medium"
      style={{
        padding: "4px 14px",
        borderRadius: 8,
        border: 0,
        background: SMDurcharbeit && actionable ? assignment.status === "in_progress" ? "#DBEAFE" : "linear-gradient(#2563EB,#1D4ED8)" : meta.background,
        color: SMDurcharbeit && assignment.status === "in_progress" ? "#1D4ED8" : meta.color,
        cursor: actionable && !launchLocked ? "pointer" : "default",
        boxShadow: actionable && assignment.status !== "in_progress"
          ? SMDurcharbeit ? "inset 0 1px .6px rgba(255,255,255,.33),0 0 0 1px #1E40AF,0 1px 5px rgba(37,99,235,.16)" : "inset 0 1px 0.6px rgba(255,255,255,0.33), inset 0 -1px 0 rgba(255,255,255,0.15), 0 0 0 1px #c42020, 0 1px 6px rgba(180,20,20,0.14)"
          : "0 0 0 0.5px rgba(0,0,0,0.06)",
        letterSpacing: "0.01em",
      }}
    >
      {starting ? <LoaderCircle size={11} className="animate-spin" aria-hidden="true" /> : meta.label}
    </button>
  );
}
