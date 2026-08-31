"use client";

import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  Camera,
  Car,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Clock3,
  FileText,
  LoaderCircle,
  MapPin,
  Navigation,
  Save,
  Store,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

import Aurora from "@/components/ui/Aurora";
import { announcePausedVisit } from "@/components/sm/SmPausedVisitNotice";
import { SmTravelTimeInput } from "@/components/sm/SmTravelTimeInput";
import {
  BackendApiError,
  clearMySmPlanningAssignmentsCache,
  clearSmVisitPendingAnswers,
  clearSmVisitPreloadCache,
  discardSmVisit,
  fetchSmVisit,
  getSmVisitStartTokenStorageKey,
  deleteSmVisitPhoto,
  queueSmVisitPendingAnswer,
  readSmVisitPreloadCache,
  readSmVisitPendingAnswers,
  removeSmVisitPendingAnswer,
  saveSmVisitAnswer,
  setSmVisitPreloadCache,
  startSmVisit,
  submitSmVisit,
  updateSmVisitTiming,
  updateSmVisitPendingAnswerVersion,
  uploadSmVisitPhotos,
} from "@/lib/api/backend";
import { computeHiddenQuestionIds } from "@/lib/conditional-visibility";
import type { SmVisitAnswer, SmVisitPayload, SmVisitQuestion, SmVisitReceipt, SmVisitSection } from "@/types/smVisit";

const RED = "#DC2626";
const ACTIVE_QUESTIONNAIRE_AURORA_COLORS = ["#F4B4B4", "#DC2626", "#F4B4B4"];

function chainColor(chain: string): { bg: string; text: string } {
  const key = chain.toUpperCase();
  if (key.includes("BILLA")) return { bg: "rgba(234,179,8,0.12)", text: "#a16207" };
  if (key.includes("SPAR")) return { bg: "rgba(220,38,38,0.08)", text: "#DC2626" };
  if (key.includes("ADEG")) return { bg: "rgba(34,197,94,0.08)", text: "#15803d" };
  if (key.includes("PENNY")) return { bg: "rgba(194,65,12,0.08)", text: "#c2410c" };
  if (key.includes("HOFER")) return { bg: "rgba(59,130,246,0.08)", text: "#2563eb" };
  return { bg: "rgba(0,0,0,0.06)", text: "#6b7280" };
}

function ActiveQuestionnaireAurora() {
  return <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[500px] opacity-[0.45]">
    <Aurora colorStops={ACTIVE_QUESTIONNAIRE_AURORA_COLORS} blend={0.6} amplitude={0.75} speed={0.3} />
  </div>;
}

function uuid(): string {
  return crypto.randomUUID();
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("de-AT", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(`${value}T12:00:00`));
}

function formatMinutes(value: number | null | undefined): string {
  if (!value) return "—";
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  if (!hours) return `${minutes} min`;
  return minutes ? `${hours} h ${minutes} min` : `${hours} h`;
}

function durationInputValue(minutes: number | null | undefined): string {
  if (minutes == null) return "";
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

function localDateTimeInputValue(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 16);
}

function localDateTimeInputIso(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function formatTimeInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

const CALENDAR_WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

function formatDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function parseDateKey(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
}

function parseMonthKey(value: string): Date {
  const [year, month] = value.split("-").map(Number);
  return new Date(year ?? 0, (month ?? 1) - 1, 1);
}

function formatVisitMonthLabel(value: string): string {
  return new Intl.DateTimeFormat("de-AT", { month: "long", year: "numeric" }).format(parseMonthKey(value));
}

function moveCalendarMonth(value: string, delta: number): string {
  const date = parseMonthKey(value);
  date.setMonth(date.getMonth() + delta);
  return formatMonthKey(date);
}

function buildCalendarDays(monthKey: string): Array<{ key: string; label: number; inMonth: boolean }> {
  const monthDate = parseMonthKey(monthKey);
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const mondayOffset = (firstOfMonth.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - mondayOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return { key: formatDateKey(day), label: day.getDate(), inMonth: day.getMonth() === month };
  });
}

function parseDurationInput(value: string): number | null {
  if (!value) return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || minutes > 59) return null;
  const total = hours * 60 + minutes;
  return total <= 1440 ? total : null;
}

function isAnswered(answer: SmVisitAnswer | null | undefined): boolean {
  if (!answer || answer.kind === "empty") return false;
  if (answer.kind === "text") return answer.value.trim().length > 0;
  if (answer.kind === "multi") return answer.optionCodes.length > 0;
  if (answer.kind === "matrix") return answer.cells.some((cell) => cell.selected);
  if (answer.kind === "photo") return answer.fileIds.length > 0;
  return true;
}

function isCompleteAnswer(question: SmVisitQuestion, answer: SmVisitAnswer | null | undefined): boolean {
  if (!isAnswered(answer)) return false;
  if (question.type !== "matrix" || answer?.kind !== "matrix") return true;
  const rows = Array.isArray(question.config.rows) ? question.config.rows : [];
  if (rows.length === 0) return false;
  const selectedRows = new Set(answer.cells.filter((cell) => cell.selected).map((cell) => cell.rowCode));
  return rows.every((_, index) => selectedRows.has(`row_${index + 1}`));
}

function defaultAnswer(question: SmVisitQuestion, current?: SmVisitAnswer | null): SmVisitAnswer {
  if (current) return current;
  if (question.type === "multiple") return { kind: "multi", optionCodes: [] };
  if (question.type === "text") return { kind: "text", value: "" };
  if (question.type === "matrix") return { kind: "matrix", cells: [] };
  if (question.type === "photo") return { kind: "photo", fileIds: [] };
  return { kind: "empty" };
}

function stableAnswer(answer: SmVisitAnswer | null | undefined): string {
  return JSON.stringify(answer ?? null);
}

function isOfflineSaveFailure(error: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  if (error instanceof BackendApiError) return false;
  if (error instanceof TypeError) return true;
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return message.includes("failed to fetch")
    || message.includes("networkerror")
    || message.includes("load failed")
    || message.includes("zu lange gedauert");
}

function smVisitAnswerRuleValue(question: SmVisitQuestion, answer: SmVisitAnswer | null | undefined): string | string[] | undefined {
  if (!answer || answer.kind === "empty") return undefined;
  const label = (code: string) => question.options.find((option) => option.code === code)?.label ?? code;
  if (answer.kind === "choice") return label(answer.optionCode);
  if (answer.kind === "multi") return answer.optionCodes.map(label);
  if (answer.kind === "yesnomulti") return JSON.stringify({ sel: label(answer.optionCode), subs: answer.subOptions });
  if (answer.kind === "text") return answer.value;
  if (answer.kind === "number") return String(answer.value);
  if (answer.kind === "matrix") return answer.cells.filter((cell) => cell.selected).map((cell) => `${cell.rowCode}:${cell.columnCode}`);
  if (answer.kind === "photo") return answer.fileIds.length ? "uploaded" : undefined;
  return undefined;
}

function resolveLocalSmVisitApplicability(payload: SmVisitPayload, answers: Record<string, SmVisitAnswer | null>): SmVisitPayload["sections"] {
  const locallyResolvableQuestions = payload.sections
    .flatMap((section) => section.questions)
    .filter((question) => question.applicable || question.applicabilityReason === "hidden_by_rule");
  const answerByQuestionId = new Map(locallyResolvableQuestions.map((question) => [
    question.id,
    smVisitAnswerRuleValue(question, answers[question.id]),
  ]));
  const hidden = computeHiddenQuestionIds(
    locallyResolvableQuestions.map((question) => ({ id: question.id, questionId: question.questionCode, rules: question.rules })),
    answerByQuestionId,
  );
  const locallyResolvableIds = new Set(locallyResolvableQuestions.map((question) => question.id));
  return payload.sections.map((section) => ({
    ...section,
    questions: section.questions.map((question) => {
      if (!locallyResolvableIds.has(question.id)) return question;
      const applicable = !hidden.has(question.id);
      return {
        ...question,
        applicable,
        applicabilityReason: applicable ? null : "hidden_by_rule",
      };
    }),
  }));
}

function withLocalSmVisitAnswer(payload: SmVisitPayload, questionId: string, answer: SmVisitAnswer): SmVisitPayload {
  const answers = { ...payload.answers, [questionId]: answer };
  return {
    ...payload,
    answers,
    sections: resolveLocalSmVisitApplicability(payload, answers),
  };
}

function withPendingSmVisitAnswers(payload: SmVisitPayload, assignmentId: string): SmVisitPayload {
  return readSmVisitPendingAnswers(assignmentId).reduce(
    (current, mutation) => withLocalSmVisitAnswer(current, mutation.submissionQuestionId, mutation.answer),
    payload,
  );
}

function flattenQuestions(sections: SmVisitSection[]): Array<{ section: SmVisitSection; question: SmVisitQuestion }> {
  return sections.flatMap((section) => section.questions.filter((question) => question.applicable).map((question) => ({ section, question })));
}

type SmVisitSaveState = "idle" | "local" | "saved" | "queued" | "error";

export function SmVisitWorkspace({ assignmentId, resumeQuestionId = null }: { assignmentId: string; resumeQuestionId?: string | null }) {
  const router = useRouter();
  const initialPayloadRef = useRef<SmVisitPayload | null | undefined>(undefined);
  if (initialPayloadRef.current === undefined) {
    const cached = readSmVisitPreloadCache(assignmentId);
    initialPayloadRef.current = cached ? withPendingSmVisitAnswers(cached, assignmentId) : null;
  }
  const initialPayload = initialPayloadRef.current ?? null;
  const [payload, setPayload] = useState<SmVisitPayload | null>(initialPayload);
  const [loading, setLoading] = useState(initialPayload === null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [draft, setDraft] = useState<SmVisitAnswer | null>(null);
  const [saveState, setSaveState] = useState<SmVisitSaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [missingRequiredIds, setMissingRequiredIds] = useState<Set<string>>(() => new Set());
  const [navigatorOpen, setNavigatorOpen] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [receipt, setReceipt] = useState<SmVisitReceipt | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [travelInput, setTravelInput] = useState("");
  const [manualInput, setManualInput] = useState("");
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [exitDialogOpen, setExitDialogOpen] = useState(false);
  const [exitStage, setExitStage] = useState<VisitExitStage>("choice");
  const [exitBusy, setExitBusy] = useState(false);
  const [exitError, setExitError] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedStateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadSequence = useRef(0);
  const payloadRef = useRef<SmVisitPayload | null>(initialPayload);
  const draftRef = useRef<SmVisitAnswer | null>(null);
  const draftQuestionIdRef = useRef<string | null>(null);
  const observedServerSignatureRef = useRef<string>(stableAnswer(null));
  const activeRef = useRef<{ section: SmVisitSection; question: SmVisitQuestion } | null>(null);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const exactSaves = useRef<Map<string, Promise<boolean>>>(new Map());
  const inFlightQuestionIdsRef = useRef<Set<string>>(new Set());
  const saveStateRef = useRef<SmVisitSaveState>("idle");
  const persistedAnswerSignaturesRef = useRef<Record<string, string>>({});
  const appliedResumeQuestionKeyRef = useRef<string | null>(null);

  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (savedStateTimer.current) clearTimeout(savedStateTimer.current);
  }, []);

  const updateSaveState = useCallback((state: SmVisitSaveState) => {
    saveStateRef.current = state;
    setSaveState(state);
  }, []);

  const applyPayload = useCallback((incoming: SmVisitPayload, options?: { fromServer?: boolean; persistCache?: boolean }) => {
    const next = options?.fromServer ? withPendingSmVisitAnswers(incoming, assignmentId) : incoming;
    if (options?.fromServer) {
      const pendingIds = new Set(readSmVisitPendingAnswers(assignmentId).map((mutation) => mutation.submissionQuestionId));
      for (const { question } of flattenQuestions(incoming.sections)) {
        if (!pendingIds.has(question.id)) {
          persistedAnswerSignaturesRef.current[question.id] = stableAnswer(incoming.answers[question.id] ?? null);
        }
      }
    }
    payloadRef.current = next;
    setPayload(next);
    setMissingRequiredIds((current) => {
      if (current.size === 0) return current;
      const visibleQuestions = new Map(flattenQuestions(next.sections).map(({ question }) => [question.id, question]));
      const unresolved = new Set([...current].filter((questionId) => {
        const question = visibleQuestions.get(questionId);
        return question ? !isCompleteAnswer(question, next.answers[questionId]) : false;
      }));
      return unresolved.size === current.size && [...unresolved].every((questionId) => current.has(questionId))
        ? current
        : unresolved;
    });
    if (next.submission?.status === "submitted") {
      clearMySmPlanningAssignmentsCache();
      clearSmVisitPendingAnswers(assignmentId);
      clearSmVisitPreloadCache(assignmentId);
    } else if (options?.persistCache !== false) setSmVisitPreloadCache(assignmentId, next);
  }, [assignmentId]);

  const reload = useCallback(async (showLoading = false) => {
    const sequence = ++loadSequence.current;
    if (showLoading) setLoading(true);
    try {
      const next = await fetchSmVisit(assignmentId);
      if (sequence !== loadSequence.current) return null;
      applyPayload(next, { fromServer: true });
      setError(null);
      if (next.submission?.status === "submitted") {
        setReceipt({
          submissionId: next.submission.id,
          submittedAt: next.submission.submittedAt ?? next.submission.lastSavedAt,
          actualMinutes: next.submission.actualMinutes,
        });
      }
      return next;
    } catch (loadError) {
      if (sequence !== loadSequence.current) return null;
      setError(loadError instanceof Error ? loadError.message : "Der Marktbesuch konnte nicht geladen werden.");
      return null;
    } finally {
      if (sequence === loadSequence.current) setLoading(false);
    }
  }, [applyPayload, assignmentId]);

  useEffect(() => {
    const cachedPayload = readSmVisitPreloadCache(assignmentId);
    const cached = cachedPayload ? withPendingSmVisitAnswers(cachedPayload, assignmentId) : null;
    if (cached) {
      applyPayload(cached);
      setLoading(false);
    } else {
      payloadRef.current = null;
      setPayload(null);
      setLoading(true);
    }
    void reload(!cached);
    return () => {
      loadSequence.current += 1;
    };
  }, [applyPayload, assignmentId, reload]);

  const flat = useMemo(() => flattenQuestions(payload?.sections ?? []), [payload?.sections]);
  const active = flat[currentIndex] ?? null;
  activeRef.current = active;

  useEffect(() => {
    if (!resumeQuestionId || flat.length === 0) return;
    const resumeKey = `${assignmentId}:${resumeQuestionId}`;
    if (appliedResumeQuestionKeyRef.current === resumeKey) return;
    const resumeIndex = flat.findIndex(({ question }) => question.id === resumeQuestionId);
    if (resumeIndex < 0) return;
    appliedResumeQuestionKeyRef.current = resumeKey;
    setCurrentIndex(resumeIndex);
  }, [assignmentId, flat, resumeQuestionId]);

  useEffect(() => {
    if (!active || !payload) {
      draftRef.current = null;
      draftQuestionIdRef.current = null;
      setDraft(null);
      return;
    }
    const serverAnswer = defaultAnswer(active.question, payload.answers[active.question.id]);
    const serverSignature = stableAnswer(serverAnswer);
    const questionChanged = draftQuestionIdRef.current !== active.question.id;
    const draftStillMatchesPreviouslyObservedServer = stableAnswer(draftRef.current) === observedServerSignatureRef.current;
    if (questionChanged || draftStillMatchesPreviouslyObservedServer) {
      draftRef.current = serverAnswer;
      setDraft(serverAnswer);
    }
    draftQuestionIdRef.current = active.question.id;
    observedServerSignatureRef.current = serverSignature;
    const pending = readSmVisitPendingAnswers(assignmentId).some((mutation) => mutation.submissionQuestionId === active.question.id);
    updateSaveState(pending ? (typeof navigator !== "undefined" && !navigator.onLine ? "queued" : "local") : "idle");
    setSaveError(null);
  }, [active?.question.id, assignmentId, payload, updateSaveState]);

  useEffect(() => {
    if (currentIndex >= flat.length && flat.length > 0) setCurrentIndex(flat.length - 1);
  }, [currentIndex, flat.length]);

  const persistAnswer = useCallback((question: SmVisitQuestion, answer: SmVisitAnswer, force = false): Promise<boolean> => {
    if (!payloadRef.current?.submission) return Promise.resolve(true);
    const answerSignature = stableAnswer(answer);
    let pending = readSmVisitPendingAnswers(assignmentId).find((mutation) => mutation.submissionQuestionId === question.id);
    if (!pending && !force && answerSignature === persistedAnswerSignaturesRef.current[question.id]) return Promise.resolve(true);
    if (
      !pending
      && !force
      && !isAnswered(answer)
      && persistedAnswerSignaturesRef.current[question.id] === stableAnswer(null)
    ) return Promise.resolve(true);
    if (!pending) {
      pending = queueSmVisitPendingAnswer({
        assignmentId,
        submissionQuestionId: question.id,
        answer,
        expectedAnswerVersion: payloadRef.current.answerVersions[question.id] ?? 0,
        clientMutationToken: uuid(),
        queuedAtMs: Date.now(),
      });
    }
    const exactKey = `${question.id}:${pending.clientMutationToken}`;
    const existingSave = exactSaves.current.get(exactKey);
    if (existingSave) return existingSave;

    if (activeRef.current?.question.id === question.id) {
      updateSaveState(typeof navigator !== "undefined" && !navigator.onLine ? "queued" : "local");
    }
    setSaveError(null);
    if (savedStateTimer.current) clearTimeout(savedStateTimer.current);

    const run = async (): Promise<boolean> => {
      if (!payloadRef.current?.submission) return true;
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        if (activeRef.current?.question.id === question.id) updateSaveState("queued");
        return true;
      }

      const attempt = async (retriedAfterConflict = false): Promise<boolean> => {
        const queued = readSmVisitPendingAnswers(assignmentId).find((mutation) => mutation.submissionQuestionId === question.id);
        if (!queued) return true;
        try {
          const result = await saveSmVisitAnswer(assignmentId, question.id, queued.answer, {
            expectedAnswerVersion: queued.expectedAnswerVersion,
            clientMutationToken: queued.clientMutationToken,
          });
          persistedAnswerSignaturesRef.current[question.id] = stableAnswer(queued.answer);
          removeSmVisitPendingAnswer(assignmentId, question.id, queued.clientMutationToken);
          updateSmVisitPendingAnswerVersion(assignmentId, question.id, result.answerVersion);
          const currentPayload = payloadRef.current;
          if (currentPayload) applyPayload({
            ...currentPayload,
            answerVersions: { ...currentPayload.answerVersions, [question.id]: result.answerVersion },
          });
          const newerPending = readSmVisitPendingAnswers(assignmentId).some((mutation) => mutation.submissionQuestionId === question.id);
          if (activeRef.current?.question.id === question.id) {
            updateSaveState(newerPending ? "local" : "saved");
            if (!newerPending) {
              savedStateTimer.current = setTimeout(() => {
                if (saveStateRef.current === "saved") updateSaveState("idle");
              }, 1_500);
            }
          }
          return true;
        } catch (saveFailure) {
          if (saveFailure instanceof BackendApiError && saveFailure.code === "sm_visit_answer_version_conflict" && !retriedAfterConflict) {
            try {
              const serverPayload = await fetchSmVisit(assignmentId);
              applyPayload(serverPayload, { fromServer: true });
              updateSmVisitPendingAnswerVersion(assignmentId, question.id, serverPayload.answerVersions[question.id] ?? 0);
              return attempt(true);
            } catch (reconcileFailure) {
              if (isOfflineSaveFailure(reconcileFailure)) {
                if (activeRef.current?.question.id === question.id) updateSaveState("queued");
                return true;
              }
            }
          }
          if (isOfflineSaveFailure(saveFailure)) {
            if (activeRef.current?.question.id === question.id) updateSaveState("queued");
            return true;
          }
          if (activeRef.current?.question.id === question.id) updateSaveState("error");
          if (activeRef.current?.question.id === question.id) {
            setSaveError(saveFailure instanceof Error ? saveFailure.message : "Die Antwort konnte nicht gespeichert werden.");
          }
          return false;
        }
      };

      inFlightQuestionIdsRef.current.add(question.id);
      try {
        return await attempt();
      } finally {
        inFlightQuestionIdsRef.current.delete(question.id);
      }
    };

    const result = saveQueue.current.then(run, run);
    saveQueue.current = result.then(() => undefined, () => undefined);
    exactSaves.current.set(exactKey, result);
    void result.finally(() => {
      if (exactSaves.current.get(exactKey) === result) exactSaves.current.delete(exactKey);
    });
    return result;
  }, [applyPayload, assignmentId, updateSaveState]);

  const saveCurrent = useCallback((answer = draftRef.current, force = false) => {
    const current = activeRef.current;
    if (!current || !answer) return Promise.resolve(true);
    return persistAnswer(current.question, answer, force);
  }, [persistAnswer]);

  useEffect(() => {
    if (!active || !draft || !payload?.submission) return;
    if (active.question.type === "photo") return;
    if (!readSmVisitPendingAnswers(assignmentId).some((mutation) => mutation.submissionQuestionId === active.question.id)) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { void persistAnswer(active.question, draft); }, active.question.type === "text" || active.question.type === "numeric" ? 750 : 280);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [active, assignmentId, draft, payload?.submission, persistAnswer]);

  const answerCurrentQuestion = useCallback((answer: SmVisitAnswer) => {
    const current = activeRef.current;
    const currentPayload = payloadRef.current;
    if (!current || !currentPayload) return;
    draftRef.current = answer;
    setDraft(answer);
    setError(null);
    setSaveError(null);
    if (currentPayload.submission && current.question.type !== "photo") {
      const existingPending = readSmVisitPendingAnswers(assignmentId).find((mutation) => mutation.submissionQuestionId === current.question.id);
      if (!existingPending && persistedAnswerSignaturesRef.current[current.question.id] === undefined) {
        persistedAnswerSignaturesRef.current[current.question.id] = stableAnswer(currentPayload.answers[current.question.id] ?? null);
      }
      if (stableAnswer(answer) === persistedAnswerSignaturesRef.current[current.question.id] && !inFlightQuestionIdsRef.current.has(current.question.id)) {
        removeSmVisitPendingAnswer(assignmentId, current.question.id);
        updateSaveState("idle");
      } else {
        queueSmVisitPendingAnswer({
          assignmentId,
          submissionQuestionId: current.question.id,
          answer,
          expectedAnswerVersion: existingPending?.expectedAnswerVersion ?? currentPayload.answerVersions[current.question.id] ?? 0,
          clientMutationToken: uuid(),
          queuedAtMs: Date.now(),
        });
        updateSaveState(typeof navigator !== "undefined" && !navigator.onLine ? "queued" : "local");
      }
    }
    applyPayload(withLocalSmVisitAnswer(currentPayload, current.question.id, answer), { persistCache: false });
    if (isCompleteAnswer(current.question, answer)) {
      setMissingRequiredIds((current) => {
        if (!current.has(activeRef.current!.question.id)) return current;
        const copy = new Set(current);
        copy.delete(activeRef.current!.question.id);
        return copy;
      });
    }
  }, [applyPayload, assignmentId, updateSaveState]);

  const flushCurrentAnswer = useCallback(async (): Promise<boolean> => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    return saveCurrent(draftRef.current);
  }, [saveCurrent]);

  const syncCurrentAnswerInBackground = useCallback(() => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    const current = activeRef.current;
    const answer = draftRef.current;
    if (!current || !answer || current.question.type === "photo") return;
    window.setTimeout(() => { void persistAnswer(current.question, answer); }, 0);
  }, [persistAnswer]);

  const syncPendingAnswers = useCallback(async (): Promise<boolean> => {
    if (!payloadRef.current?.submission || typeof navigator !== "undefined" && navigator.onLine === false) return false;
    const questions = new Map(payloadRef.current.sections.flatMap((section) => section.questions).map((question) => [question.id, question]));
    const pending = readSmVisitPendingAnswers(assignmentId);
    for (const mutation of pending) {
      const question = questions.get(mutation.submissionQuestionId);
      if (!question || question.type === "photo") continue;
      if (!(await persistAnswer(question, mutation.answer, true))) return false;
    }
    await saveQueue.current;
    const complete = readSmVisitPendingAnswers(assignmentId).length === 0;
    if (complete && pending.length > 0) {
      try { applyPayload(await fetchSmVisit(assignmentId), { fromServer: true }); } catch { /* The local payload is already reconciled. */ }
    }
    return complete;
  }, [applyPayload, assignmentId, persistAnswer]);

  useEffect(() => {
    if (!payload?.submission || payload.submission.status !== "draft") return;
    const sync = () => { void syncPendingAnswers(); };
    window.addEventListener("online", sync);
    sync();
    return () => window.removeEventListener("online", sync);
  }, [payload?.submission?.id, payload?.submission?.status, syncPendingAnswers]);

  useEffect(() => {
    const hasUnsavedWork = () => {
      const current = activeRef.current;
      const currentPayload = payloadRef.current;
      if (!current || !currentPayload?.submission || !draftRef.current) return false;
      return saveStateRef.current === "error";
    };
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedWork()) return;
      event.preventDefault();
      event.returnValue = "";
    };
    const onVisibilityChange = () => {
      if (document.visibilityState !== "hidden" || !hasUnsavedWork()) return;
      void flushCurrentAnswer();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [assignmentId, flushCurrentAnswer]);

  const start = async (mode: "timer" | "manual") => {
    if (!payload) return;
    const travelMinutes = parseDurationInput(travelInput);
    if (travelInput && travelMinutes === null) { setError("Bitte gib die Fahrtzeit als hh:mm ein."); return; }
    setStarting(true);
    setError(null);
    try {
      const storageKey = getSmVisitStartTokenStorageKey(assignmentId);
      const token = localStorage.getItem(storageKey) ?? uuid();
      localStorage.setItem(storageKey, token);
      const next = await startSmVisit(assignmentId, { mode, travelMinutes, clientSubmissionToken: token });
      clearSmVisitPendingAnswers(assignmentId);
      applyPayload(next, { fromServer: true });
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : "Der Marktbesuch konnte nicht gestartet werden.");
    } finally {
      setStarting(false);
    }
  };

  const goNext = () => {
    if (!active) return;
    const currentAnswer = draftRef.current
      ?? defaultAnswer(active.question, payloadRef.current?.answers[active.question.id]);
    if (photoBusy) {
      setPhotoError("Bitte warte, bis alle Fotos gespeichert wurden.");
      return;
    }
    if (active.question.required && !isCompleteAnswer(active.question, currentAnswer)) {
      setMissingRequiredIds((current) => new Set(current).add(active.question.id));
      setSaveError("Bitte beantworte diese Pflichtfrage, bevor du fortfährst.");
      return;
    }
    syncCurrentAnswerInBackground();
    const nextFlat = flattenQuestions(payloadRef.current?.sections ?? []);
    const position = nextFlat.findIndex((entry) => entry.question.id === active.question.id);
    if (position < 0 || position >= nextFlat.length - 1) setReviewing(true);
    else setCurrentIndex(position + 1);
  };

  const goPrevious = () => {
    if (!active || currentIndex <= 0 || photoBusy) return;
    syncCurrentAnswerInBackground();
    const nextFlat = flattenQuestions(payloadRef.current?.sections ?? []);
    const position = nextFlat.findIndex((entry) => entry.question.id === active.question.id);
    setCurrentIndex(Math.max(0, position > 0 ? position - 1 : 0));
  };

  const goToQuestion = (questionId: string) => {
    if (photoBusy) {
      setPhotoError("Bitte warte, bis alle Fotos gespeichert wurden.");
      return;
    }
    syncCurrentAnswerInBackground();
    const nextFlat = flattenQuestions(payloadRef.current?.sections ?? []);
    const index = nextFlat.findIndex((entry) => entry.question.id === questionId);
    if (index < 0) {
      setNavigatorOpen(false);
      setSaveError("Diese Frage ist durch die aktuelle Antwort nicht mehr relevant.");
      return;
    }
    setCurrentIndex(index);
    setNavigatorOpen(false);
  };

  const uploadPhotos = async (questionId: string, files: File[]) => {
    setPhotoBusy(true);
    setPhotoError(null);
    try {
      await uploadSmVisitPhotos(assignmentId, questionId, files);
      const next = await fetchSmVisit(assignmentId);
      applyPayload(next, { fromServer: true });
      updateSaveState("saved");
    } catch (uploadError) {
      try {
        applyPayload(await fetchSmVisit(assignmentId), { fromServer: true });
      } catch {
        // Keep the original upload error; a later retry/reload will reconcile the payload.
      }
      setPhotoError(uploadError instanceof Error ? uploadError.message : "Die Fotos konnten nicht hochgeladen werden.");
      updateSaveState("error");
    } finally {
      setPhotoBusy(false);
    }
  };

  const removePhoto = async (fileId: string) => {
    setPhotoBusy(true);
    setPhotoError(null);
    try {
      await deleteSmVisitPhoto(assignmentId, fileId);
      applyPayload(await fetchSmVisit(assignmentId), { fromServer: true });
    } catch (deleteError) {
      setPhotoError(deleteError instanceof Error ? deleteError.message : "Das Foto konnte nicht entfernt werden.");
    } finally {
      setPhotoBusy(false);
    }
  };

  const openExitOptions = () => {
    setExitError(null);
    setExitStage("choice");
    setExitDialogOpen(true);
  };

  const continueVisitLater = async () => {
    if (exitBusy) return;
    setExitBusy(true);
    setExitError(null);
    try {
      syncCurrentAnswerInBackground();
      announcePausedVisit(assignmentId, payload?.assignment.market.name ?? "Marktbesuch", activeRef.current?.question.id);
      router.push(`/sm?pausedVisit=${encodeURIComponent(assignmentId)}`);
    } catch (exitFailure) {
      setExitError(exitFailure instanceof Error ? exitFailure.message : "Der Marktbesuch konnte nicht gespeichert werden.");
    } finally {
      setExitBusy(false);
    }
  };

  const discardVisit = async () => {
    if (exitBusy) return;
    setExitBusy(true);
    setExitError(null);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    try {
      await discardSmVisit(assignmentId);
      clearMySmPlanningAssignmentsCache();
      clearSmVisitPendingAnswers(assignmentId);
      clearSmVisitPreloadCache(assignmentId);
      window.localStorage.removeItem(getSmVisitStartTokenStorageKey(assignmentId));
      router.replace("/sm");
    } catch (exitFailure) {
      setExitError(exitFailure instanceof Error ? exitFailure.message : "Der gestartete Einsatz konnte nicht verworfen werden.");
    } finally {
      setExitBusy(false);
    }
  };

  const finalize = async (reviewTiming: { visitStartedAt?: string; visitCompletedAt?: string; travelMinutes?: number | null } = {}) => {
    if (!payload?.submission) return;
    const manualMinutes = parseDurationInput(manualInput || durationInputValue(payload.submission.manualVisitMinutes));
    if (payload.submission.visitTimeMode === "manual" && !manualMinutes) {
      setError("Bitte trage die tatsächliche Besuchszeit als hh:mm ein.");
      return;
    }
    if (!(await flushCurrentAnswer())) {
      setError("Die letzte Antwort konnte noch nicht gespeichert werden. Bitte versuche es erneut.");
      return;
    }
    if (!(await syncPendingAnswers())) {
      setError("Deine Antworten sind auf diesem Gerät gespeichert. Zum Abschließen wird eine Internetverbindung benötigt.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await saveQueue.current;
      const timingUpdate: { manualVisitMinutes?: number; travelMinutes?: number | null } = {};
      if (payload.submission.visitTimeMode === "manual" && manualMinutes !== payload.submission.manualVisitMinutes) timingUpdate.manualVisitMinutes = manualMinutes!;
      if (reviewTiming.travelMinutes !== undefined && reviewTiming.travelMinutes !== payload.submission.travelMinutes) timingUpdate.travelMinutes = reviewTiming.travelMinutes;
      if (Object.keys(timingUpdate).length > 0) {
        const next = await updateSmVisitTiming(assignmentId, timingUpdate);
        applyPayload(next, { fromServer: true });
      }
      const nextReceipt = await submitSmVisit(assignmentId, {
        ...(manualMinutes ? { actualMinutes: manualMinutes } : {}),
        ...(reviewTiming.visitStartedAt ? { visitStartedAt: reviewTiming.visitStartedAt } : {}),
        ...(reviewTiming.visitCompletedAt ? { visitCompletedAt: reviewTiming.visitCompletedAt } : {}),
      });
      setReceipt(nextReceipt);
      clearMySmPlanningAssignmentsCache();
      clearSmVisitPendingAnswers(assignmentId);
      clearSmVisitPreloadCache(assignmentId);
      window.localStorage.removeItem(getSmVisitStartTokenStorageKey(assignmentId));
      setMissingRequiredIds(new Set());
      setReviewing(false);
    } catch (submitError) {
      if (submitError instanceof BackendApiError && submitError.code === "sm_visit_required_answers_missing") {
        const data = submitError.data as { details?: { questionIds?: unknown } } | null;
        const questionIds = Array.isArray(data?.details?.questionIds)
          ? data.details.questionIds.filter((id): id is string => typeof id === "string")
          : [];
        setMissingRequiredIds(new Set(questionIds));
        const nextFlat = flattenQuestions(payloadRef.current?.sections ?? []);
        const firstMissingIndex = nextFlat.findIndex((entry) => questionIds.includes(entry.question.id));
        if (firstMissingIndex >= 0) {
          setCurrentIndex(firstMissingIndex);
          setReviewing(false);
          setSaveError(submitError.message);
        }
      }
      setError(submitError instanceof Error ? submitError.message : "Der Marktbesuch konnte nicht abgeschlossen werden.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || starting && !payload?.submission) return <FullPageState icon={<LoaderCircle className="animate-spin" size={22} />} title="Marktbesuch wird vorbereitet" text="Einsatz und Fragebogen werden sicher geladen." />;
  if (!payload) return <FullPageError message={error ?? "Der Marktbesuch konnte nicht geladen werden."} onBack={() => router.push("/sm")} onRetry={() => void reload(true)} />;
  if (receipt || payload.submission?.status === "submitted") return (
    <ReceiptScreen
      payload={payload}
      receipt={receipt}
      onDone={() => {
        // Clear immediately before the schedule remounts as well as when the
        // submission succeeds. This prevents the dashboard from painting a
        // completed assignment from its long-lived offline schedule snapshot.
        clearMySmPlanningAssignmentsCache();
        router.push("/sm");
      }}
    />
  );
  if (!payload.submission) return <StartScreen payload={payload} travelInput={travelInput} onTravelInput={setTravelInput} busy={starting} error={error} onBack={() => router.push("/sm")} onStartTimer={() => void start("timer")} onManual={() => void start("manual")} />;
  if (reviewing) return <ReviewScreen payload={payload} flat={flat} manualInput={manualInput} onManualInput={setManualInput} error={error} busy={submitting} onBack={() => setReviewing(false)} onSubmit={(timing) => void finalize(timing)} />;
  if (!active) return <FullPageError message="Der veröffentlichte Fragebogen enthält keine sichtbaren Fragen." onBack={() => router.push("/sm")} onRetry={() => void reload(true)} />;

  return (
    <main className="relative h-[100dvh] overflow-hidden bg-[#f5f5f7] text-gray-900">
      <ActiveQuestionnaireAurora />
      <div className="relative z-10 mx-auto flex h-[100dvh] min-w-0 w-full max-w-[460px] flex-col overflow-hidden bg-transparent">
        <VisitHeader payload={payload} onBack={openExitOptions} />
        <QuestionProgress flat={flat} currentIndex={currentIndex} answers={{ ...payload.answers, [active.question.id]: draft }} />

        <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto px-4 pb-[calc(64px+env(safe-area-inset-bottom))] pt-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="my-auto w-full shrink-0 py-3">
            <QuestionCard question={active.question} answer={draft ?? defaultAnswer(active.question)} onAnswer={answerCurrentQuestion} saveState={saveState} saveError={photoError ?? saveError} photoFiles={payload.photoFiles[active.question.id] ?? []} photoBusy={photoBusy} onPhotoUpload={(files) => void uploadPhotos(active.question.id, files)} onPhotoDelete={(fileId) => void removePhoto(fileId)} questionNumber={currentIndex + 1} questionCount={flat.length} previousDisabled={currentIndex === 0} nextLabel={currentIndex === flat.length - 1 ? "Zur Übersicht" : "Weiter"} onPrevious={() => void goPrevious()} onNext={() => void goNext()} />
          </div>
        </section>
        <QuickNavigationFlap sectionName={active.section.name} questionText={active.question.text} currentIndex={currentIndex} questionCount={flat.length} answeredCount={flat.filter(({ question }) => isCompleteAnswer(question, question.id === active.question.id ? draft : payload.answers[question.id])).length} onOpen={() => setNavigatorOpen(true)} />
      </div>
      {navigatorOpen && typeof document !== "undefined" ? createPortal(<QuickNavigator sections={payload.sections} currentQuestionId={active.question.id} answers={{ ...payload.answers, [active.question.id]: draft }} missingRequiredIds={missingRequiredIds} onClose={() => setNavigatorOpen(false)} onSelect={(questionId) => { void goToQuestion(questionId); }} />, document.body) : null}
      <VisitExitDialog open={exitDialogOpen} stage={exitStage} busy={exitBusy} error={exitError} onOpenChange={setExitDialogOpen} onStageChange={(stage) => { setExitStage(stage); setExitError(null); }} onContinueLater={() => void continueVisitLater()} onDiscard={() => void discardVisit()} />
    </main>
  );
}

function VisitHeader({ payload, onBack }: { payload: SmVisitPayload; onBack: () => void }) {
  const market = payload.assignment.market;
  return <header className="relative z-20 px-4 pb-1 pt-[max(14px,env(safe-area-inset-top))]">
    <div className="flex items-center gap-2.5">
      <button type="button" onClick={onBack} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/75 text-black/50 shadow-[0_1px_4px_rgba(0,0,0,.07)]" aria-label="Marktbesuch verlassen"><ChevronLeft size={14} /></button>
      <div className="flex min-w-0 flex-1 items-center gap-2"><span className="max-w-[44%] truncate rounded-md bg-red-50 px-2 py-0.5 text-[9px] font-bold text-red-700">{market.name}</span><span className="min-w-0 flex-1 truncate text-[9px] text-black/35">{market.address} · {market.postalCode} {market.city}</span></div>
      {payload.submission?.visitStartedAt ? <TimerLabel startedAt={payload.submission.visitStartedAt} /> : null}
    </div>
  </header>;
}

function TimerLabel({ startedAt }: { startedAt: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 30_000); return () => window.clearInterval(timer); }, []);
  const minutes = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 60_000));
  return <span className="inline-flex shrink-0 items-center gap-1 text-[9px] font-bold tabular-nums text-red-600"><span className="h-1 w-1 animate-pulse rounded-full bg-red-600" />{formatMinutes(minutes)}</span>;
}

type VisitExitStage = "choice" | "discard-confirm";

function VisitExitDialog({ open, stage, busy, error, onOpenChange, onStageChange, onContinueLater, onDiscard }: {
  open: boolean;
  stage: VisitExitStage;
  busy: boolean;
  error: string | null;
  onOpenChange: (open: boolean) => void;
  onStageChange: (stage: VisitExitStage) => void;
  onContinueLater: () => void;
  onDiscard: () => void;
}) {
  if (!open || typeof document === "undefined") return null;
  return createPortal(<div role="presentation" onMouseDown={(event) => { if (!busy && event.target === event.currentTarget) onOpenChange(false); }} className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/20 px-4 py-6 backdrop-blur-[8px]">
    <section role="dialog" aria-modal="true" aria-label={stage === "choice" ? "Marktbesuch verlassen" : "Einsatz verwerfen bestätigen"} onMouseDown={(event) => event.stopPropagation()} className="w-full max-w-[360px] rounded-[16px] border border-black/[0.06] bg-white p-4 shadow-[0_2px_8px_rgba(0,0,0,.04),0_18px_42px_rgba(15,23,42,.12)]" aria-live="polite">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[9px] font-extrabold uppercase tracking-[.09em] text-red-600">Marktbesuch</p>
          <h2 className="mt-1 text-[14px] font-extrabold tracking-[-.02em] text-[#1a1a1a]">{stage === "choice" ? "Wie möchtest du fortfahren?" : "Einsatz wirklich verwerfen?"}</h2>
        </div>
        <button type="button" disabled={!open || busy} onClick={() => onOpenChange(false)} aria-label="Hinweis schließen" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-black/[0.035] text-black/35 disabled:pointer-events-none"><X size={12} /></button>
      </div>

      {stage === "choice" ? <>
        <p className="mt-2 text-[10px] leading-[1.5] text-black/45">Deine bisherigen Antworten sind gespeichert. Du kannst den Einsatz später an derselben Stelle fortsetzen oder den gestarteten Lauf vollständig verwerfen.</p>
        {error ? <p role="alert" className="mt-3 rounded-[9px] border border-red-200 bg-red-50 px-3 py-2 text-[9px] font-semibold leading-relaxed text-red-700">{error}</p> : null}
        <div className="mt-4 grid gap-2">
          <button type="button" disabled={!open || busy} onClick={onContinueLater} className="flex h-9 items-center justify-center gap-1.5 rounded-lg bg-gradient-to-b from-emerald-500 to-emerald-600 text-[10px] font-bold text-white shadow-[inset_0_1px_.6px_rgba(255,255,255,.32),0_0_0_1px_#048560,0_1px_6px_rgba(5,80,50,.14)] disabled:bg-none disabled:bg-black/[0.08] disabled:text-black/25 disabled:shadow-none">{busy ? <LoaderCircle size={12} className="animate-spin" /> : <Save size={12} />} {busy ? "Speichere..." : "Später fortsetzen"}</button>
          <button type="button" disabled={!open || busy} onClick={() => onStageChange("discard-confirm")} className="flex h-8 items-center justify-center gap-1.5 rounded-lg border border-red-100 bg-red-50/70 text-[10px] font-bold text-red-500 disabled:opacity-45"><Trash2 size={11} />Einsatz verwerfen</button>
        </div>
      </> : <>
        <div className="mt-3 rounded-[10px] border border-red-200 bg-red-50/80 px-3 py-2.5 text-[9px] font-semibold leading-[1.5] text-red-800">Alle Antworten, Fotos und der Fortschritt dieses Laufs werden gelöscht. Der geplante Einsatz bleibt bestehen und kann danach neu gestartet werden.</div>
        {error ? <p role="alert" className="mt-3 rounded-[9px] border border-red-200 bg-red-50 px-3 py-2 text-[9px] font-semibold leading-relaxed text-red-700">{error}</p> : null}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" disabled={!open || busy} onClick={() => onStageChange("choice")} className="h-9 rounded-lg bg-black/[0.04] text-[10px] font-semibold text-black/50 disabled:opacity-45">Zurück</button>
          <button type="button" disabled={!open || busy} onClick={onDiscard} className="flex h-9 items-center justify-center gap-1.5 rounded-lg bg-gradient-to-b from-red-600 to-red-700 text-[10px] font-bold text-white shadow-[inset_0_1px_.6px_rgba(255,255,255,.32),0_0_0_1px_#a91b1b,0_1px_6px_rgba(180,20,20,.18)] disabled:bg-none disabled:bg-black/[0.08] disabled:text-black/25 disabled:shadow-none">{busy ? <LoaderCircle size={12} className="animate-spin" /> : <Trash2 size={11} />}{busy ? "Verwerfe..." : "Endgültig verwerfen"}</button>
        </div>
      </>}
    </section>
  </div>, document.body);
}

function QuestionProgress({ flat, currentIndex, answers }: { flat: Array<{ section: SmVisitSection; question: SmVisitQuestion }>; currentIndex: number; answers: Record<string, SmVisitAnswer | null> }) {
  const count = flat.length;
  const answeredCount = flat.filter(({ question }) => isCompleteAnswer(question, answers[question.id])).length;
  const allAnswered = count > 0 && answeredCount === count;
  const fill = count <= 1 ? 100 : (currentIndex / (count - 1)) * 100;
  return <div className="px-4 pt-3">
    <div className="flex items-center gap-2">
      <div className="relative flex h-4 min-w-0 flex-1 items-center">
        <span className={`absolute inset-x-0 h-0.5 rounded-full ${allAnswered ? "bg-emerald-500/20" : "bg-black/[0.08]"}`} />
        <span className={`absolute left-0 h-0.5 rounded-full transition-[width] duration-300 ${allAnswered ? "bg-gradient-to-r from-emerald-600 to-emerald-500" : "bg-gradient-to-r from-red-700 to-red-600"}`} style={{ width: `${fill}%` }} />
        {flat.map(({ question }, index) => { const done = isCompleteAnswer(question, answers[question.id]); const current = index === currentIndex; const left = count <= 1 ? 50 : (index / (count - 1)) * 100; return <span key={question.id} className={`absolute -translate-x-1/2 rounded-full transition-all ${current && !done ? "h-[9px] w-[9px] bg-red-600/45 ring-[3px] ring-red-600/10" : `h-[7px] w-[7px] ${done ? allAnswered ? "bg-emerald-500 ring-2 ring-emerald-500/20" : "bg-red-600 ring-2 ring-red-600/15" : "bg-black/[0.12]"}`}`} style={{ left: `${left}%` }} />; })}
      </div>
      <span className="shrink-0 text-[9px] font-semibold text-black/30">{answeredCount}/{count}</span>
    </div>
  </div>;
}

function QuickNavigationFlap({ sectionName, questionText, currentIndex, questionCount, answeredCount, onOpen }: { sectionName: string; questionText: string; currentIndex: number; questionCount: number; answeredCount: number; onOpen: () => void }) {
  return <button type="button" onClick={onOpen} aria-label="Schnellnavigation öffnen" className="fixed inset-x-0 bottom-0 z-30 mx-auto flex w-full max-w-[460px] items-center gap-2.5 rounded-t-[14px] border border-b-0 border-white/90 bg-white/90 px-4 pb-[max(14px,env(safe-area-inset-bottom))] pt-2.5 text-left shadow-[0_-2px_16px_rgba(0,0,0,.06)] backdrop-blur-2xl">
    <span className="absolute left-1/2 top-1 h-[3px] w-7 -translate-x-1/2 rounded-full bg-black/10" />
    <span className="max-w-[28%] truncate text-[10px] font-bold text-red-600">{sectionName}</span>
    <span className="h-3.5 w-px shrink-0 bg-black/[0.08]" />
    <span className="min-w-0 flex-1 truncate text-[10px] font-normal text-black/40">{currentIndex + 1}/{questionCount} — {questionText}</span>
    <span className="shrink-0 rounded-full bg-black/[0.04] px-2 py-0.5 text-[9px] font-bold text-black/35">{answeredCount}/{questionCount}</span>
    <ChevronDown size={11} strokeWidth={2.5} className="shrink-0 text-black/30" />
  </button>;
}

function StartScreen({ payload, travelInput, onTravelInput, busy, error, onBack, onStartTimer, onManual, embedded = false }: { payload: SmVisitPayload; travelInput: string; onTravelInput: (value: string) => void; busy: boolean; error: string | null; onBack: () => void; onStartTimer: () => void; onManual: () => void; embedded?: boolean }) {
  const market = payload.assignment.market;
  const marketColor = chainColor(market.name);
  const blocked = busy || payload.questionnaireAvailability.count !== 1;
  return <main className={`relative flex items-center justify-center overflow-hidden bg-[#f5f5f7] px-6 pb-20 pt-16 text-gray-900 ${embedded ? "min-h-full" : "min-h-[100dvh]"}`}>
    <ActiveQuestionnaireAurora />
    <button type="button" onClick={onBack} aria-label="Zurück zum Dashboard" className="absolute left-4 top-[max(14px,env(safe-area-inset-top))] z-20 flex h-8 w-8 items-center justify-center rounded-lg bg-white/75 text-black/50 shadow-[0_1px_4px_rgba(0,0,0,.07)] backdrop-blur-lg"><ArrowLeft size={14} /></button>
    <section className="relative z-10 w-full max-w-[320px] rounded-[18px] border border-white/90 bg-white/75 px-6 pb-[22px] pt-7 shadow-[0_2px_24px_rgba(0,0,0,.06),0_1px_4px_rgba(0,0,0,.04)] backdrop-blur-2xl">
      <div className="mb-[22px] flex min-w-0 items-center gap-[7px]">
        <MapPin size={13} strokeWidth={1.6} className="shrink-0 text-black/30" />
        <span className="max-w-[42%] truncate rounded-md px-2 py-0.5 text-[9px] font-bold tracking-[.04em]" style={{ backgroundColor: marketColor.bg, color: marketColor.text }}>{market.name}</span>
        <span className="min-w-0 flex-1 truncate text-[9px] font-normal text-black/40">{market.address}{market.postalCode ? ` · ${market.postalCode} ${market.city}` : ""}</span>
      </div>
      <div className="mb-5 h-px bg-black/[0.05]" />
      <div className="mb-[22px]">
        <h1 className="text-[15px] font-bold tracking-[-.02em] text-[#1a1a1a]">Aktiver Marktbesuch</h1>
        <p className="mt-1 text-[11px] leading-[1.5] text-black/[0.38]">Timer läuft automatisch. Du kannst die Zeit danach anpassen.</p>
      </div>
      {payload.profile.travelTimeEnabled ? <label className="block">
        <span className="text-[8px] font-extrabold uppercase tracking-[.08em] text-black/70">Fahrtzeit <span className="font-semibold normal-case tracking-normal text-black/45">(optional)</span></span>
        <span className="mt-1.5 flex h-10 items-center gap-2.5 rounded-[9px] border border-black/[0.08] bg-black/[0.018] px-3 transition focus-within:border-red-300 focus-within:bg-white">
          <Car size={14} strokeWidth={1.9} className="shrink-0 text-red-500" />
          <SmTravelTimeInput value={travelInput} onValueChange={onTravelInput} className="h-full min-w-0 flex-1 bg-transparent text-center text-[16px] font-semibold tabular-nums outline-none placeholder:text-black/20" />
        </span>
      </label> : null}
      {payload.questionnaireAvailability.count === 0 ? <p className="mt-3 rounded-[9px] bg-amber-50 px-3 py-2 text-[9px] leading-relaxed text-amber-800">Für diesen Einsatz ist aktuell noch kein veröffentlichter SM-Fragebogen verfügbar.</p> : null}
      {payload.questionnaireAvailability.count > 1 ? <p className="mt-3 rounded-[9px] bg-amber-50 px-3 py-2 text-[9px] leading-relaxed text-amber-800">Mehrere Fragebögen sind gültig. Ordne dem Einsatz in der Verplanung einen konkreten Fragebogen zu.</p> : null}
      {error ? <p role="alert" className="mt-3 rounded-[9px] bg-red-50 px-3 py-2 text-[9px] font-semibold leading-relaxed text-red-700">{error}</p> : null}
      <button type="button" disabled={blocked} onClick={onStartTimer} className={`${payload.profile.travelTimeEnabled ? "mt-5" : ""} flex h-[36px] w-full items-center justify-center gap-1.5 rounded-[9px] bg-gradient-to-b from-[#DC2626] to-[#b91c1c] text-[11px] font-bold text-white shadow-[inset_0_1px_.6px_rgba(255,255,255,.33),inset_0_-1px_0_rgba(255,255,255,.15),0_0_0_1px_#a91b1b,0_1px_6px_rgba(180,20,20,.18)] disabled:bg-none disabled:bg-black/[0.08] disabled:text-black/25 disabled:shadow-none`}>{busy ? <LoaderCircle size={12} className="animate-spin" /> : <Clock3 size={12} />}Timer starten</button>
      <button type="button" disabled={blocked} onClick={onManual} className="mt-2 flex h-7 w-full items-center justify-center text-[10px] font-medium text-black/30 disabled:opacity-40">Überspringen und manuell eintragen</button>
    </section>
  </main>;
}

type SmVisitPhotoFile = SmVisitPayload["photoFiles"][string][number];

type QuestionCardProps = {
  question: SmVisitQuestion;
  answer: SmVisitAnswer;
  onAnswer: (answer: SmVisitAnswer) => void;
  saveState: SmVisitSaveState;
  saveError: string | null;
  photoFiles: SmVisitPhotoFile[];
  photoBusy: boolean;
  onPhotoUpload: (files: File[]) => void;
  onPhotoDelete: (fileId: string) => void;
  questionNumber: number;
  questionCount: number;
  previousDisabled: boolean;
  nextLabel: string;
  onPrevious: () => void;
  onNext: () => void;
};

function QuestionCard({ question, answer, onAnswer, saveState, saveError, photoFiles, photoBusy, onPhotoUpload, onPhotoDelete, questionNumber, questionCount, previousDisabled, nextLabel, onPrevious, onNext }: QuestionCardProps) {
  return <article className="flex min-w-0 w-full flex-col overflow-hidden rounded-[14px] border border-white/90 bg-white/80 px-4 pb-4 pt-[18px] shadow-[0_2px_16px_rgba(0,0,0,.05),0_1px_4px_rgba(0,0,0,.04)] backdrop-blur-2xl">
    <div className="flex items-center justify-between gap-3">
      <span className="text-[9px] font-bold uppercase tracking-[.07em] text-black/25">{questionTypeLabel(question.type)} · {questionNumber} von {questionCount}</span>
      <SaveState state={saveState} />
    </div>
    <h1 className="mt-3 break-words text-[13px] font-semibold leading-[1.5] tracking-[-.01em] text-[#1a1a1a]">{question.text}{question.required ? <span className="ml-1 text-[11px] text-red-600">*</span> : null}</h1>
    {typeof question.config.instruction === "string" && question.config.instruction ? <p className="mt-2 text-[10px] italic leading-relaxed text-black/40">{question.config.instruction}</p> : null}
    <QuestionImageCarousel question={question} />
    <div className="mt-4 min-h-0 min-w-0"><QuestionInput question={question} answer={answer} onAnswer={onAnswer} photoFiles={photoFiles} photoBusy={photoBusy} onPhotoUpload={onPhotoUpload} onPhotoDelete={onPhotoDelete} /></div>
    {saveError ? <p role="alert" className="mt-3 flex items-start gap-2 rounded-[9px] bg-red-50 px-3 py-2 text-[9px] font-semibold leading-relaxed text-red-700"><AlertCircle size={11} className="mt-0.5 shrink-0" />{saveError}</p> : null}
    <div className="mt-4 border-t border-black/[0.055] pt-3">
      <div className="flex gap-2">
        <button type="button" disabled={previousDisabled} onClick={onPrevious} className="flex h-9 items-center justify-center gap-1 rounded-lg bg-white px-3 text-[10px] font-semibold text-black/40 shadow-[0_1px_4px_rgba(0,0,0,.06),inset_0_0_0_1px_rgba(0,0,0,.06)] disabled:bg-black/[0.03] disabled:text-black/15 disabled:shadow-none"><ChevronLeft size={12} />Zurück</button>
        <button type="button" onClick={onNext} className="flex h-9 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg bg-gradient-to-b from-[#DC2626] to-[#b91c1c] text-[11px] font-bold text-white shadow-[inset_0_1px_.6px_rgba(255,255,255,.33),inset_0_-1px_0_rgba(255,255,255,.15),0_0_0_1px_#a91b1b,0_1px_6px_rgba(180,20,20,.18)]">{nextLabel}<ChevronRight size={12} strokeWidth={2.5} /></button>
      </div>
    </div>
  </article>;
}

function QuestionImageCarousel({ question }: { question: SmVisitQuestion }) {
  const urls = useMemo(() => {
    if (!Array.isArray(question.config.images)) return [];
    return question.config.images
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }, [question.config.images]);
  const signature = urls.join("||");
  const [activeIndex, setActiveIndex] = useState(0);
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    setActiveIndex(0);
  }, [question.id, signature]);

  useEffect(() => {
    if (urls.length <= 1) return;
    const timer = window.setInterval(() => setActiveIndex((current) => (current + 1) % urls.length), 3_000);
    return () => window.clearInterval(timer);
  }, [signature, urls.length]);

  const activeUrl = urls[activeIndex] ?? urls[0];
  useEffect(() => {
    setDimensions(null);
    if (!activeUrl) return;
    const image = new Image();
    image.onload = () => setDimensions({ width: image.naturalWidth, height: image.naturalHeight });
    image.src = activeUrl;
  }, [activeUrl]);

  if (!activeUrl) return null;
  const maxWidth = 280;
  const maxHeight = 170;
  const ratio = dimensions && dimensions.height > 0 ? dimensions.width / dimensions.height : 16 / 10;
  const displayWidth = Math.min(maxWidth, Math.round(maxHeight * ratio));
  const displayHeight = Math.min(maxHeight, Math.round(displayWidth / ratio));

  return <div className="mt-3 flex flex-col items-center">
    <div className="w-full overflow-hidden rounded-[10px] border border-white/80 bg-black/[0.035] shadow-[0_2px_12px_rgba(0,0,0,.10),0_1px_4px_rgba(0,0,0,.06)] transition-[width,aspect-ratio] duration-300" style={{ width: `${displayWidth}px`, maxWidth: "100%", aspectRatio: `${displayWidth} / ${displayHeight}` }}>
      <img key={activeUrl} src={activeUrl} alt={`Referenzbild ${activeIndex + 1} zu dieser Frage`} className="h-full w-full object-cover" />
    </div>
    {urls.length > 1 ? <div className="mt-2 flex items-center gap-1" aria-label={`${activeIndex + 1} von ${urls.length} Referenzbildern`}>{urls.map((url, index) => <span key={url} className={`h-1 rounded-full transition-all ${index === activeIndex ? "w-3 bg-red-600" : "w-1 bg-black/15"}`} />)}</div> : null}
  </div>;
}

function questionTypeLabel(type: SmVisitQuestion["type"]): string {
  return {
    single: "Einzelauswahl",
    yesno: "Ja / Nein",
    yesnomulti: "Ja / Nein + Auswahl",
    multiple: "Mehrfachauswahl",
    likert: "Skala",
    text: "Freitext",
    numeric: "Zahl",
    slider: "Regler",
    photo: "Foto",
    matrix: "Matrix",
  }[type];
}

function SaveState({ state }: { state: SmVisitSaveState }) {
  if (state === "local") return <span aria-live="polite" className="inline-flex items-center gap-1.5 text-[9px] font-semibold text-gray-400"><Save size={10} />Auf Gerät gesichert</span>;
  if (state === "saved") return <span aria-live="polite" className="inline-flex items-center gap-1.5 text-[9px] font-semibold text-emerald-600"><Check size={10} />Synchronisiert</span>;
  if (state === "queued") return <span aria-live="polite" className="inline-flex items-center gap-1.5 text-[9px] font-semibold text-amber-600"><Save size={10} />Offline gesichert</span>;
  if (state === "error") return <span aria-live="assertive" className="inline-flex items-center gap-1.5 text-[9px] font-semibold text-red-600"><AlertCircle size={10} />Synchronisierung offen</span>;
  return <span className="text-[9px] text-gray-300">Automatisch gesichert</span>;
}

function QuestionInput({ question, answer, onAnswer, photoFiles, photoBusy, onPhotoUpload, onPhotoDelete }: { question: SmVisitQuestion; answer: SmVisitAnswer; onAnswer: (answer: SmVisitAnswer) => void; photoFiles: SmVisitPhotoFile[]; photoBusy: boolean; onPhotoUpload: (files: File[]) => void; onPhotoDelete: (fileId: string) => void }) {
  if (["single", "yesno", "likert"].includes(question.type)) return <ChoiceInput question={question} answer={answer} onAnswer={onAnswer} />;
  if (question.type === "multiple") return <MultiInput question={question} answer={answer} onAnswer={onAnswer} />;
  if (question.type === "yesnomulti") return <YesNoMultiInput question={question} answer={answer} onAnswer={onAnswer} />;
  if (question.type === "text") {
    const value = answer.kind === "text" ? answer.value : "";
    return <div><textarea value={value} onChange={(event) => onAnswer({ kind: "text", value: event.target.value })} rows={4} maxLength={20_000} placeholder="Antwort eingeben…" className="min-h-[112px] w-full resize-none rounded-[9px] border-[1.5px] border-black/[0.09] bg-black/[0.02] px-3 py-2.5 text-[12px] leading-[1.55] outline-none transition placeholder:text-black/20 focus:border-red-300 focus:bg-white" /><p className="mt-1.5 text-right text-[8px] tabular-nums text-black/20">{value.length.toLocaleString("de-AT")} / 20.000</p></div>;
  }
  if (question.type === "numeric") return <NumericInput question={question} answer={answer} onAnswer={onAnswer} />;
  if (question.type === "slider") return <SliderInput question={question} answer={answer} onAnswer={onAnswer} />;
  if (question.type === "matrix") return <MatrixInput question={question} answer={answer} onAnswer={onAnswer} />;
  return <PhotoInput files={photoFiles} busy={photoBusy} onUpload={onPhotoUpload} onDelete={onPhotoDelete} />;
}

function ChoiceInput({ question, answer, onAnswer }: { question: SmVisitQuestion; answer: SmVisitAnswer; onAnswer: (answer: SmVisitAnswer) => void }) {
  const selected = answer.kind === "choice" ? answer.optionCode : answer.kind === "yesnomulti" ? answer.optionCode : null;
  if (question.type === "yesno") {
    return <div className="flex min-w-0 gap-[7px]">{question.options.map((option, index) => { const active = selected === option.code; return <button key={option.code} type="button" aria-label={option.label} onClick={() => onAnswer({ kind: "choice", optionCode: option.code })} className={`box-border h-9 min-w-0 flex-1 rounded-[9px] border px-1.5 text-[10px] font-bold tracking-[.01em] transition ${active ? "border-[#a91b1b] bg-gradient-to-b from-[#DC2626] to-[#b91c1c] text-white shadow-[inset_0_1px_.6px_rgba(255,255,255,.33),inset_0_-1px_0_rgba(255,255,255,.15),0_2px_8px_rgba(180,20,20,.18)]" : "border-transparent bg-black/[0.04] text-black/45"}`}>{compactYesNoLabel(option.label, index)}</button>; })}</div>;
  }
  if (question.type === "likert") {
    const count = question.options.length;
    const colorAt = (index: number) => {
      const t = count <= 1 ? 1 : index / (count - 1);
      if (t < 0.5) {
        const s = t / 0.5;
        return [Math.round(220 + 14 * s), Math.round(38 + 141 * s), Math.round(38 - 30 * s)] as const;
      }
      const s = (t - 0.5) / 0.5;
      return [Math.round(234 - 212 * s), Math.round(179 - 16 * s), Math.round(8 + 66 * s)] as const;
    };
    return <div><div className="flex flex-wrap gap-1">{question.options.map((option, index) => { const active = selected === option.code; const [r, g, b] = colorAt(index); const dark = `rgb(${Math.round(r * .84)},${Math.round(g * .84)},${Math.round(b * .84)})`; return <button key={option.code} type="button" onClick={() => onAnswer({ kind: "choice", optionCode: option.code })} className="box-border h-9 min-w-[32px] flex-1 rounded-[9px] border px-1 text-[11px] font-bold text-black/50 transition" style={active ? { color: "#fff", borderColor: dark, background: `linear-gradient(to bottom,rgb(${r},${g},${b}),${dark})`, boxShadow: `inset 0 1px .6px rgba(255,255,255,.33),inset 0 -1px 0 rgba(255,255,255,.15),0 1px 6px rgba(${r},${g},${b},.18)` } : { borderColor: "transparent", background: "rgba(0,0,0,.04)" }}>{option.label}</button>; })}</div><div className="mt-[7px] flex justify-between gap-5 px-0.5 text-[9px] font-medium leading-relaxed text-black/35"><span className="max-w-[46%]">{String(question.config.minLabel ?? "")}</span><span className="max-w-[46%] text-right">{String(question.config.maxLabel ?? "")}</span></div></div>;
  }
  return <div className="max-h-[42dvh] space-y-[5px] overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{question.options.map((option) => { const active = selected === option.code; return <button key={option.code} type="button" onClick={() => onAnswer({ kind: "choice", optionCode: option.code })} className={`box-border flex min-h-[38px] w-full items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left text-[11px] font-medium leading-[1.35] transition ${active ? "border-red-200 bg-red-600/[0.05] text-red-600" : "border-transparent bg-black/[0.03] text-black/60"}`}><span className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border ${active ? "border-red-600 bg-red-600" : "border-black/15"}`}>{active ? <Check size={8} strokeWidth={3} className="text-white" /> : null}</span><span className="break-words">{option.label}</span></button>; })}</div>;
}

function MultiInput({ question, answer, onAnswer }: { question: SmVisitQuestion; answer: SmVisitAnswer; onAnswer: (answer: SmVisitAnswer) => void }) {
  const selected = answer.kind === "multi" ? answer.optionCodes : [];
  return <div><div className="mb-2 text-[9px] font-semibold text-black/35">{selected.length} ausgewählt</div><div className="max-h-[42dvh] space-y-[5px] overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{question.options.map((option) => { const active = selected.includes(option.code); return <button key={option.code} type="button" onClick={() => onAnswer({ kind: "multi", optionCodes: active ? selected.filter((code) => code !== option.code) : [...selected, option.code] })} className={`box-border flex min-h-[38px] w-full items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left text-[11px] font-medium leading-[1.35] transition ${active ? "border-red-200 bg-red-600/[0.05] text-red-600" : "border-transparent bg-black/[0.03] text-black/60"}`}><span className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[3px] border ${active ? "border-red-600 bg-red-600" : "border-black/15"}`}>{active ? <Check size={8} strokeWidth={3} className="text-white" /> : null}</span><span className="break-words">{option.label}</span></button>; })}</div></div>;
}

function YesNoMultiInput({ question, answer, onAnswer }: { question: SmVisitQuestion; answer: SmVisitAnswer; onAnswer: (answer: SmVisitAnswer) => void }) {
  const current = answer.kind === "yesnomulti" ? answer : null;
  const branches = Array.isArray(question.config.branches) ? question.config.branches as Array<{ answer?: unknown; options?: unknown }> : [];
  const selectedLabel = question.options.find((option) => option.code === current?.optionCode)?.label;
  const branch = branches.find((entry) => typeof entry.answer === "string" && entry.answer.trim() === selectedLabel?.trim());
  const subOptions = Array.isArray(branch?.options) ? branch.options.filter((entry): entry is string => typeof entry === "string" && Boolean(entry.trim())).map((entry) => entry.trim()) : [];
  return <div className="min-w-0 space-y-2">
    <div className="flex min-w-0 gap-[7px]">
      {question.options.map((option, index) => {
        const active = current?.optionCode === option.code;
        return <button key={option.code} type="button" aria-label={option.label} onClick={() => onAnswer({ kind: "yesnomulti", optionCode: option.code, subOptions: [] })} className={`box-border h-9 min-w-0 flex-1 rounded-[9px] border px-1.5 text-[10px] font-bold transition ${active ? "border-[#a91b1b] bg-gradient-to-b from-[#DC2626] to-[#b91c1c] text-white shadow-[inset_0_1px_.6px_rgba(255,255,255,.33),inset_0_-1px_0_rgba(255,255,255,.15),0_2px_8px_rgba(180,20,20,.18)]" : "border-transparent bg-black/[0.04] text-black/45"}`}>{compactYesNoLabel(option.label, index)}</button>;
      })}
    </div>
    {subOptions.length ? <div className="overflow-hidden rounded-[10px] border border-black/[0.06] bg-black/[0.02]">
      <div className="flex items-center justify-between border-b border-black/[0.05] px-3 py-[7px]">
        <span className="text-[9px] font-semibold uppercase tracking-[.04em] text-black/35">Optionen für „{selectedLabel}“</span>
        {current?.subOptions.length ? <span className="rounded-full bg-red-600/[0.08] px-2 py-0.5 text-[9px] font-bold text-red-600">{current.subOptions.length} gewählt</span> : null}
      </div>
      <div className="max-h-[220px] space-y-[3px] overflow-y-auto px-2 py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {subOptions.map((option) => {
          const active = current?.subOptions.includes(option) ?? false;
          return <button key={option} type="button" onClick={() => current && onAnswer({ ...current, subOptions: active ? current.subOptions.filter((value) => value !== option) : [...current.subOptions, option] })} className={`box-border flex min-h-9 w-full items-center gap-2.5 rounded-[7px] border px-2.5 py-2 text-left text-[11px] font-medium leading-[1.35] ${active ? "border-red-200 bg-red-600/[0.05] text-red-600" : "border-transparent bg-black/[0.025] text-black/60"}`}><span className={`flex h-[13px] w-[13px] shrink-0 items-center justify-center rounded-[3px] border ${active ? "border-red-600 bg-red-600" : "border-black/[0.13]"}`}>{active ? <Check size={7} strokeWidth={3} className="text-white" /> : null}</span><span className="break-words">{option}</span></button>;
        })}
      </div>
    </div> : null}
  </div>;
}

function compactYesNoLabel(label: string, index: number): string {
  const normalized = label.trim().toLocaleLowerCase("de-AT");
  if (/^(ja|yes)\b/.test(normalized)) return "Ja";
  if (/^(nein|no)\b/.test(normalized)) return "Nein";
  if (index === 0) return "Ja";
  if (index === 1) return "Nein";
  return label;
}

function NumericInput({ question, answer, onAnswer }: { question: SmVisitQuestion; answer: SmVisitAnswer; onAnswer: (answer: SmVisitAnswer) => void }) {
  const current = answer.kind === "number" ? answer.value : "";
  const min = question.config.min === "" || question.config.min == null ? undefined : Number(question.config.min);
  const max = question.config.max === "" || question.config.max == null ? undefined : Number(question.config.max);
  return <div><input type="number" inputMode={question.config.decimals === true ? "decimal" : "numeric"} step={question.config.decimals === true ? "any" : 1} min={min} max={max} value={current} onChange={(event) => { if (event.target.value === "") { onAnswer({ kind: "empty" }); return; } const value = event.target.valueAsNumber; if (Number.isFinite(value)) onAnswer({ kind: "number", value }); }} placeholder="0" className="h-10 w-full rounded-[9px] border-[1.5px] border-black/[0.09] bg-black/[0.02] px-3 text-center text-[13px] font-semibold tabular-nums outline-none placeholder:text-black/20 focus:border-red-300 focus:bg-white" /><p className="mt-2 text-center text-[9px] text-black/35">{min != null ? `Min. ${min}` : ""}{min != null && max != null ? " · " : ""}{max != null ? `Max. ${max}` : ""}{question.config.decimals === true ? " · Dezimalwerte erlaubt" : ""}</p></div>;
}

function SliderInput({ question, answer, onAnswer }: { question: SmVisitQuestion; answer: SmVisitAnswer; onAnswer: (answer: SmVisitAnswer) => void }) {
  const min = Number(question.config.min ?? 0); const max = Number(question.config.max ?? 100); const step = Number(question.config.step ?? 1) || 1; const answered = answer.kind === "number"; const value = answered ? answer.value : min; const unit = String(question.config.unit ?? "");
  const set = (next: number) => onAnswer({ kind: "number", value: Math.min(max, Math.max(min, Number(next.toFixed(8)))) });
  const pct = max === min ? 0 : ((value - min) / (max - min)) * 100;
  return <div><div className="mb-2.5 flex items-center justify-between"><span className="text-[10px] font-medium text-black/35">{min}{unit}</span><span className={`text-[15px] font-bold tracking-[-.02em] ${answered ? "text-red-600" : "text-black/25"}`}>{answered ? `${value.toLocaleString("de-AT")}${unit}` : "—"}</span><span className="text-[10px] font-medium text-black/35">{max}{unit}</span></div><div className="relative flex h-5 items-center"><span className="absolute inset-x-0 h-[3px] rounded-full bg-black/[0.07]" /><span className="absolute left-0 h-[3px] rounded-full bg-gradient-to-r from-[#DC2626] to-[#b91c1c]" style={{ width: `${pct}%` }} /><input type="range" aria-label="Wert auswählen" min={min} max={max} step={step} value={value} onChange={(event) => set(Number(event.target.value))} className="absolute inset-x-0 h-5 w-full cursor-pointer opacity-0" /><span className="pointer-events-none absolute h-3 w-3 rounded-full bg-gradient-to-b from-[#DC2626] to-[#b91c1c] shadow-[0_0_0_1px_#a91b1b,0_1px_4px_rgba(180,20,20,.35)]" style={{ left: `calc(${pct}% - 6px)` }} /></div><p className="mt-2 text-center text-[9px] text-black/30">Schrittweite {step}</p></div>;
}

function MatrixInput({ question, answer, onAnswer }: { question: SmVisitQuestion; answer: SmVisitAnswer; onAnswer: (answer: SmVisitAnswer) => void }) {
  const rows = (Array.isArray(question.config.rows) ? question.config.rows : []).filter((entry): entry is string => typeof entry === "string" && Boolean(entry.trim()));
  const columns = (Array.isArray(question.config.columns) ? question.config.columns : []).filter((entry): entry is string => typeof entry === "string" && Boolean(entry.trim()));
  const cells = answer.kind === "matrix" ? answer.cells : [];
  return <div>
    <p className="mb-2 text-[9px] text-black/35">{new Set(cells.filter((cell) => cell.selected).map((cell) => cell.rowCode)).size} von {rows.length} Zeilen beantwortet</p>
    <div className="-mx-4 max-h-[42dvh] overflow-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <table className="border-separate border-spacing-[3px]" style={{ minWidth: `${Math.max(300, columns.length * 52 + 120)}px` }}>
        <thead><tr><th className="w-[110px] px-1.5 py-1" />{columns.map((column) => <th key={column} title={column} className="max-w-12 truncate px-1 py-1 text-center text-[9px] font-semibold text-black/45">{column}</th>)}</tr></thead>
        <tbody>{rows.map((row, rowIndex) => {
          const rowCode = `row_${rowIndex + 1}`;
          const selected = cells.find((cell) => cell.rowCode === rowCode && cell.selected)?.columnCode;
          return <tr key={rowCode}>
            <td title={row} className="max-w-[110px] truncate px-1.5 py-1 text-[10px] font-medium text-black/65">{row}</td>
            {columns.map((column, columnIndex) => {
              const columnCode = `column_${columnIndex + 1}`;
              const active = selected === columnCode;
              return <td key={columnCode} className="px-[3px] py-0.5 text-center">
                <button type="button" aria-label={`${row}: ${column}`} onClick={() => onAnswer({ kind: "matrix", cells: [...cells.filter((cell) => cell.rowCode !== rowCode), { rowCode, columnCode, selected: true }] })} className={`box-border h-8 w-full rounded-[7px] border text-[10px] font-semibold transition ${active ? "border-red-200 bg-red-600/[0.07] text-red-600" : "border-black/[0.06] bg-black/[0.03] text-black/35"}`}>{active ? "✓" : "○"}</button>
              </td>;
            })}
          </tr>;
        })}</tbody>
      </table>
    </div>
  </div>;
}

function PhotoInput({ files, busy, onUpload, onDelete }: { files: SmVisitPhotoFile[]; busy: boolean; onUpload: (files: File[]) => void; onDelete: (fileId: string) => void }) {
  const [sourceOpen, setSourceOpen] = useState(false);
  const pick = (list: FileList | null) => {
    const selected = [...(list ?? [])];
    if (selected.length) onUpload(selected);
    setSourceOpen(false);
  };
  return <div>
    <button type="button" disabled={busy} onClick={() => setSourceOpen((open) => !open)} className="flex min-h-[72px] w-full items-center justify-center gap-2 rounded-[10px] border-[1.5px] border-dashed border-black/[0.13] bg-black/[0.02] text-[11px] font-semibold text-black/50 disabled:opacity-55">{busy ? <LoaderCircle size={15} className="animate-spin text-red-600" /> : <Camera size={15} className="text-red-600" />}{busy ? "Foto wird hochgeladen…" : files.length ? "Weiteres Foto hinzufügen" : "Foto hinzufügen"}</button>
    {sourceOpen ? <div className="mt-1.5 grid grid-cols-2 gap-1.5 rounded-[10px] bg-black/[0.02] p-1.5 shadow-[inset_0_0_0_1px_rgba(0,0,0,.05)]"><label className="flex h-10 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-white text-[10px] font-semibold text-black/55 shadow-[0_1px_3px_rgba(0,0,0,.05)]"><Camera size={12} className="text-red-600" />Kamera<input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="sr-only" onChange={(event) => { pick(event.target.files); event.currentTarget.value = ""; }} /></label><label className="flex h-10 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-white text-[10px] font-semibold text-black/55 shadow-[0_1px_3px_rgba(0,0,0,.05)]"><Store size={12} />Mediathek<input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={(event) => { pick(event.target.files); event.currentTarget.value = ""; }} /></label></div> : null}
    <p className="mt-1.5 text-center text-[8px] text-black/30">JPG, PNG oder WebP · maximal 15 MB</p>
    {files.length ? <div className="mt-3 grid grid-cols-3 gap-1.5">{files.map((file) => <div key={file.id} className="relative aspect-square overflow-hidden rounded-lg bg-black/[0.04]">{file.signedUrl ? <img src={file.signedUrl} alt={file.fileName ?? "Besuchsfoto"} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-center text-[8px] text-black/30">Keine Vorschau</div>}<button type="button" disabled={busy} onClick={() => onDelete(file.id)} aria-label="Foto entfernen" className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-white disabled:opacity-50"><X size={10} /></button></div>)}</div> : null}
  </div>;
}

function QuickNavigator({ sections, currentQuestionId, answers, missingRequiredIds = new Set(), onClose, onSelect }: { sections: SmVisitSection[]; currentQuestionId: string; answers: Record<string, SmVisitAnswer | null>; missingRequiredIds?: Set<string>; onClose: () => void; onSelect: (questionId: string) => void }) {
  const visibleQuestions = sections.flatMap((section) => section.questions.filter((question) => question.applicable));
  const answeredCount = visibleQuestions.filter((question) => isCompleteAnswer(question, answers[question.id])).length;
  const currentModuleId = sections.find((section) => section.questions.some((question) => question.id === currentQuestionId))?.id;
  const [expandedModuleIds, setExpandedModuleIds] = useState<Set<string>>(() => new Set(currentModuleId ? [currentModuleId] : []));
  const toggleModule = (moduleId: string) => {
    setExpandedModuleIds((current) => {
      const next = new Set(current);
      if (next.has(moduleId)) next.delete(moduleId);
      else next.add(moduleId);
      return next;
    });
  };

  return <div className="fixed inset-0 z-[100] flex items-end bg-black/15" onClick={onClose}>
    <section role="dialog" aria-modal="true" aria-label="Schnellnavigation" onClick={(event) => event.stopPropagation()} className="mx-auto flex max-h-[72dvh] w-full max-w-[460px] flex-col overflow-hidden rounded-t-2xl border border-b-0 border-white/90 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_32px_rgba(0,0,0,.08)] backdrop-blur-2xl">
      <div className="flex h-5 shrink-0 items-center justify-center"><span className="h-[3px] w-8 rounded-full bg-black/10" /></div>
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-black/[0.055] px-5 pb-3">
        <div className="min-w-0 flex-1"><p className="text-[13px] font-bold tracking-[-.01em] text-[#1a1a1a]">Schnellnavigation</p><p className="mt-0.5 text-[9px] text-black/35">{answeredCount} von {visibleQuestions.length} Fragen beantwortet</p></div>
        <button type="button" onClick={onClose} aria-label="Schnellnavigation schließen" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-black/[0.04] text-black/35"><X size={12} /></button>
      </header>
      <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-4 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{sections.map((section) => {
        const applicable = section.questions.filter((question) => question.applicable);
        const completed = applicable.filter((question) => isCompleteAnswer(question, answers[question.id])).length;
        const expanded = expandedModuleIds.has(section.id);
        const complete = completed === applicable.length && applicable.length > 0;
        const questionListId = `quick-nav-module-${section.id}`;
        return <div key={section.id} className="overflow-hidden rounded-[11px] border border-black/[0.065] bg-white/70 shadow-[0_1px_4px_rgba(0,0,0,.025)]">
          <button type="button" aria-expanded={expanded} aria-controls={questionListId} onClick={() => toggleModule(section.id)} className={`flex min-h-[46px] w-full items-center gap-2.5 px-3 py-2 text-left transition ${expanded ? "bg-black/[0.018]" : "bg-transparent"}`}>
            <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-[7px] ${complete ? "bg-red-600 text-white" : "bg-black/[0.045] text-black/30"}`}>{complete ? <Check size={10} strokeWidth={3} /> : <FileText size={10} strokeWidth={1.8} />}</span>
            <span className="min-w-0 flex-1"><span className="block truncate text-[10px] font-semibold text-black/65">{section.name}</span><span className="mt-0.5 block text-[8px] font-medium text-black/28">{applicable.length} {applicable.length === 1 ? "Frage" : "Fragen"}</span></span>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[8px] font-bold tabular-nums ${complete ? "bg-red-50 text-red-600" : "bg-black/[0.04] text-black/35"}`}>{completed}/{applicable.length}</span>
            <ChevronDown size={12} strokeWidth={2.2} className={`shrink-0 text-black/30 transition-transform ${expanded ? "rotate-0" : "-rotate-90"}`} />
          </button>
          {expanded ? <div id={questionListId} className="space-y-1 border-t border-black/[0.055] bg-black/[0.012] p-2">{applicable.map((question, questionIndex) => {
            const answered = isCompleteAnswer(question, answers[question.id]);
            const current = question.id === currentQuestionId;
            const missing = missingRequiredIds.has(question.id);
            return <button key={question.id} type="button" onClick={() => onSelect(question.id)} className={`flex min-h-9 w-full items-center gap-2.5 rounded-[8px] border px-2.5 py-1.5 text-left transition ${current || missing ? "border-red-200 bg-red-50/80 shadow-[0_1px_3px_rgba(220,38,38,.06)]" : "border-transparent bg-transparent"}`}>
              <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] text-[8px] font-bold ${answered ? "bg-red-600 text-white" : current || missing ? "bg-red-100 text-red-600" : "bg-black/[0.05] text-black/30"}`}>{answered ? <Check size={7} strokeWidth={3} /> : questionIndex + 1}</span>
              <span className={`min-w-0 flex-1 truncate text-[10px] ${current ? "font-semibold text-[#1a1a1a]" : answered ? "font-normal text-black/30 line-through" : "font-normal text-black/50"}`}>{question.text}</span>
              {current ? <span className="h-1 w-1 shrink-0 rounded-full bg-red-600" /> : null}
            </button>;
          })}</div> : null}
        </div>;
      })}</div>
    </section>
  </div>;
}

interface ClockPickerProps {
  onSelect: (h: number, m: number) => void;
  onCancel: () => void;
  initialHour?: number;
  initialMinute?: number;
}

function ClockPicker({ onSelect, onCancel, initialHour = 8, initialMinute = 0 }: ClockPickerProps) {
  const [step, setStep] = useState<"hour" | "minute">("hour");
  const [hour, setHour] = useState(initialHour);
  const [minute, setMinute] = useState(initialMinute);
  const hours = Array.from({ length: 24 }, (_, index) => index);
  const minutes = Array.from({ length: 12 }, (_, index) => index * 5);
  const items = step === "hour" ? hours : minutes;
  const selected = step === "hour" ? hour : minute;
  const radius = 114;
  const center = 135;
  const numberRadius = 93;

  const positionFor = (value: number) => {
    const inner = step === "hour" && value >= 12;
    const itemRadius = inner ? numberRadius - 22 : numberRadius;
    const index = step === "hour" ? value % 12 : value / 5;
    const angle = (index / 12) * 360 - 90;
    const radians = (angle * Math.PI) / 180;
    return { x: center + itemRadius * Math.cos(radians), y: center + itemRadius * Math.sin(radians) };
  };

  const handleTap = (value: number) => {
    if (step === "hour") {
      setHour(value);
      setTimeout(() => setStep("minute"), 200);
    } else {
      setMinute(value);
      setTimeout(() => onSelect(hour, value), 150);
    }
  };

  const selectedIndex = step === "hour" ? selected % 12 : selected / 5;
  const selectedAngle = (selectedIndex / 12) * 360 - 90;
  const selectedRadians = (selectedAngle * Math.PI) / 180;
  const selectedInner = step === "hour" && selected >= 12;
  const lineRadius = selectedInner ? numberRadius - 22 : numberRadius;

  return <div role="dialog" aria-modal="true" aria-label="Uhrzeit auswählen" style={{ position: "fixed", inset: 0, zIndex: 250, width: "100vw", height: "100dvh", display: "flex", alignItems: "stretch", justifyContent: "center", overflow: "hidden", backgroundColor: "rgba(245,245,247,0.94)", backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)", padding: "max(16px, env(safe-area-inset-top)) 16px max(16px, env(safe-area-inset-bottom))" }} onClick={onCancel}>
    <div onClick={(event) => event.stopPropagation()} style={{ width: "100%", height: "100%", maxWidth: 460, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", animation: "clockOverlayIn 0.2s ease" }}>
      <style>{`@keyframes clockOverlayIn { from { opacity: 0; transform: scale(0.97); } to { opacity: 1; transform: scale(1); } }`}</style>
      <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(0,0,0,0.35)", marginBottom: 8 }}>{step === "hour" ? "Stunde" : "Minute"}</span>
      <svg viewBox="0 0 270 270" style={{ width: "min(84vw, 340px, 56dvh)", height: "auto", flexShrink: 0 }}>
        <circle cx={center} cy={center} r={radius} fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth={1} />
        <line x1={center} y1={center} x2={center + lineRadius * Math.cos(selectedRadians)} y2={center + lineRadius * Math.sin(selectedRadians)} stroke="#DC2626" strokeWidth={1.5} strokeLinecap="round" style={{ transition: "all 0.15s ease" }} />
        <circle cx={center} cy={center} r={3} fill="#DC2626" />
        {items.map((value) => {
          const position = positionFor(value);
          const active = value === selected;
          const label = step === "hour" ? String(value) : String(value).padStart(2, "0");
          return <g key={value} onClick={() => handleTap(value)} style={{ cursor: "pointer" }}>
            {active ? <circle cx={position.x} cy={position.y} r={21} fill="#DC2626" style={{ transition: "all 0.15s ease" }} /> : null}
            <text x={position.x} y={position.y} textAnchor="middle" dominantBaseline="central" fontSize={step === "hour" && value >= 12 ? 11 : 13} fontWeight={active ? 700 : 500} fill={active ? "#fff" : "rgba(0,0,0,0.55)"} style={{ transition: "fill 0.15s ease", userSelect: "none" }}>{label}</text>
          </g>;
        })}
      </svg>
      <span style={{ marginTop: 6, fontSize: 16, fontWeight: 600, color: "#DC2626", fontVariantNumeric: "tabular-nums" }}>{String(hour).padStart(2, "0")}:{String(minute).padStart(2, "0")}</span>
      <button type="button" onClick={onCancel} style={{ marginTop: 8, fontSize: 10, fontWeight: 500, color: "rgba(0,0,0,0.35)", background: "none", border: "none", cursor: "pointer", padding: "4px 12px" }}>Abbrechen</button>
    </div>
  </div>;
}

function VisitDatePicker({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  const [open, setOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() => formatMonthKey(value ? parseDateKey(value) : new Date()));
  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [panelPosition, setPanelPosition] = useState({ top: 0, left: 0 });
  const calendarDays = useMemo(() => buildCalendarDays(visibleMonth), [visibleMonth]);

  useEffect(() => {
    if (!open) return;
    setVisibleMonth(formatMonthKey(value ? parseDateKey(value) : new Date()));
  }, [open, value]);

  useEffect(() => {
    if (!open) return;
    const positionPanel = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = 252;
      const height = 224;
      const left = Math.min(Math.max(rect.right - width, 8), window.innerWidth - width - 8);
      const top = window.innerHeight - rect.bottom > height + 12 ? rect.bottom + 6 : Math.max(8, rect.top - height - 6);
      setPanelPosition({ top, left });
    };
    positionPanel();
    window.addEventListener("resize", positionPanel);
    window.addEventListener("scroll", positionPanel, true);
    return () => {
      window.removeEventListener("resize", positionPanel);
      window.removeEventListener("scroll", positionPanel, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (containerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onEscape);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onEscape);
    };
  }, [open]);

  return <div ref={containerRef} style={{ position: "relative", display: "inline-flex" }}>
    <style>{`.visit-date-trigger:hover { background: rgba(0,0,0,0.04) !important; } .visit-date-day:hover { background: rgba(0,0,0,0.06) !important; color: #111827 !important; }`}</style>
    <button ref={triggerRef} className="visit-date-trigger" type="button" aria-label="Besuchstag wählen" onClick={() => setOpen((current) => !current)} style={{ width: 22, height: 22, borderRadius: 6, border: "none", background: "transparent", color: "#111827", padding: 0, outline: "none", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, cursor: "pointer", boxShadow: "none", transition: "all 0.14s ease", fontFamily: "inherit" }}>
      <Calendar size={11} strokeWidth={1.8} color={open ? "rgba(220,38,38,0.8)" : "rgba(0,0,0,0.25)"} />
    </button>
    {open && typeof document !== "undefined" ? createPortal(<div ref={panelRef} style={{ position: "fixed", top: panelPosition.top, left: panelPosition.left, width: 252, zIndex: 220, borderRadius: 11, border: "1px solid rgba(0,0,0,0.10)", background: "#fff", boxShadow: "0 14px 32px rgba(0,0,0,0.15)", padding: 8 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
        <button type="button" aria-label="Vorheriger Monat" onClick={() => setVisibleMonth((current) => moveCalendarMonth(current, -1))} style={{ width: 25, height: 25, borderRadius: 8, border: "1px solid rgba(0,0,0,0.08)", background: "linear-gradient(to bottom,#fff,#f5f5f6)", color: "rgba(15,23,42,0.55)", display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><ChevronLeft size={13} strokeWidth={2.2} /></button>
        <div style={{ fontSize: 12, fontWeight: 850, color: "#111827", textTransform: "capitalize" }}>{formatVisitMonthLabel(visibleMonth)}</div>
        <button type="button" aria-label="Naechster Monat" onClick={() => setVisibleMonth((current) => moveCalendarMonth(current, 1))} style={{ width: 25, height: 25, borderRadius: 8, border: "1px solid rgba(0,0,0,0.08)", background: "linear-gradient(to bottom,#fff,#f5f5f6)", color: "rgba(15,23,42,0.55)", display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><ChevronRight size={13} strokeWidth={2.2} /></button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0,1fr))", gap: 3 }}>
        {CALENDAR_WEEKDAYS.map((weekday) => <div key={weekday} style={{ textAlign: "center", fontSize: 9, fontWeight: 800, color: "rgba(100,116,139,0.58)", padding: "2px 0 4px" }}>{weekday}</div>)}
        {calendarDays.map((day) => {
          const active = day.key === value;
          return <button key={day.key} className="visit-date-day" type="button" onClick={() => { onChange(day.key); setOpen(false); }} style={{ height: 24, border: active ? "1px solid rgba(220,38,38,0.24)" : "1px solid transparent", borderRadius: active ? 8 : 7, background: active ? "linear-gradient(to bottom,rgba(254,242,242,0.96),rgba(255,255,255,0.92))" : "transparent", color: active ? "#B91C1C" : day.inMonth ? "#111827" : "rgba(100,116,139,0.30)", fontSize: 10, fontWeight: active ? 850 : 700, cursor: "pointer", boxShadow: active ? "inset 0 1px 0.6px rgba(255,255,255,0.92), 0 1px 4px rgba(220,38,38,0.08)" : "none", boxSizing: "border-box" }}>{day.label}</button>;
        })}
      </div>
    </div>, document.body) : null}
  </div>;
}

function ReviewScreen({ payload, flat, manualInput, onManualInput, error, busy, onBack, onSubmit }: { payload: SmVisitPayload; flat: Array<{ section: SmVisitSection; question: SmVisitQuestion }>; manualInput: string; onManualInput: (value: string) => void; error: string | null; busy: boolean; onBack: () => void; onSubmit: (timing: { visitStartedAt?: string; visitCompletedAt?: string; travelMinutes?: number | null }) => void }) {
  const missing = flat.filter((entry) => entry.question.required && !isCompleteAnswer(entry.question, payload.answers[entry.question.id]));
  const submission = payload.submission!;
  const hasTimestampPair = submission.visitTimeMode === "timer" && Boolean(submission.visitStartedAt);
  const [startValue, setStartValue] = useState(() => hasTimestampPair ? localDateTimeInputValue(submission.visitStartedAt) : "");
  const [endValue, setEndValue] = useState(() => hasTimestampPair ? localDateTimeInputValue(new Date().toISOString()) : "");
  const [travelValue, setTravelValue] = useState(() => durationInputValue(submission.travelMinutes));
  const [clockTarget, setClockTarget] = useState<"start" | "end" | null>(null);
  const startIso = hasTimestampPair ? localDateTimeInputIso(startValue) : null;
  const endIso = hasTimestampPair ? localDateTimeInputIso(endValue) : null;
  const timestampMinutes = startIso && endIso ? Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60_000) : null;
  const timestampError = hasTimestampPair && (!startIso || !endIso || !timestampMinutes || timestampMinutes < 1 || timestampMinutes > 1440)
    ? "Die Endzeit muss nach der Startzeit liegen und höchstens 24 Stunden später sein."
    : null;
  const manualValue = manualInput || durationInputValue(submission.manualVisitMinutes);
  const manualMinutes = parseDurationInput(manualValue);
  const timingInvalid = hasTimestampPair ? Boolean(timestampError) : !manualMinutes;
  const duration = hasTimestampPair ? timestampMinutes : manualMinutes;
  const travelMinutes = travelValue.trim() ? parseDurationInput(travelValue) : null;
  const travelError = payload.profile.travelTimeEnabled && travelValue.trim() && travelMinutes === null ? "Bitte gib die Fahrtzeit als HH:MM ein." : null;

  return <main className="relative min-h-[100dvh] overflow-hidden bg-[#f5f5f7] px-4 pb-28 pt-[max(16px,env(safe-area-inset-top))] text-gray-900">
    <ActiveQuestionnaireAurora />
    <div className="relative z-10 mx-auto max-w-[430px]">
      <button type="button" onClick={onBack} aria-label="Zurück zum Fragebogen" className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-white/90 bg-white/75 text-black/45 shadow-[0_1px_4px_rgba(0,0,0,.07)] backdrop-blur-xl"><ArrowLeft size={14} /></button>
      <div className="mt-5">
        <p className="text-[9px] font-bold uppercase tracking-[.09em] text-red-500">Abschluss</p>
        <h1 className="mt-2 text-[22px] font-extrabold tracking-[-.03em]">Antworten prüfen</h1>
        <p className="mt-2 max-w-[360px] text-[11px] leading-[1.55] text-black/35">Kontrolliere die Zeitangaben, bevor du den Marktbesuch abschließt.</p>
      </div>

      <section className="mt-5 rounded-[14px] border border-white/90 bg-white/75 p-4 shadow-[0_2px_16px_rgba(0,0,0,.05),0_1px_4px_rgba(0,0,0,.03)] backdrop-blur-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[8px] font-bold uppercase tracking-[.08em] text-black/25">Gesamtzeit</p>
            <p className={`mt-1 text-[21px] font-extrabold leading-none tabular-nums tracking-[-.02em] ${duration ? "text-red-600" : "text-black/20"}`}>{duration ? formatMinutes(duration) : "—"}</p>
          </div>
          <div className="text-right">
            <span className={`inline-flex rounded-full px-2.5 py-1 text-[8px] font-bold ${hasTimestampPair ? "bg-red-50 text-red-600" : "bg-black/[0.04] text-black/35"}`}>{hasTimestampPair ? "Timer" : "Manuell"}</span>
          </div>
        </div>
        <div className="my-3 h-px bg-black/[0.055]" />

        {hasTimestampPair ? <div className="space-y-2">
          <ReviewTimestampField label="Start" tone="green" value={startValue} onChange={setStartValue} onOpenClock={() => setClockTarget("start")} />
          <ReviewTimestampField label="Ende" tone="red" value={endValue} onChange={setEndValue} onOpenClock={() => setClockTarget("end")} />
        </div> : <label className="flex items-center gap-2.5">
          <span className="w-12 shrink-0 text-[10px] font-semibold text-red-600">Dauer</span>
          <span className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-[8px] border border-black/[0.06] bg-black/[0.025] px-3 focus-within:border-red-200 focus-within:bg-white/80">
            <input value={manualValue} onChange={(event) => onManualInput(event.target.value)} inputMode="numeric" pattern="[0-9:]*" maxLength={5} placeholder="HH:MM" aria-label="Tatsächliche Besuchszeit" className="h-full min-w-0 flex-1 bg-transparent text-[13px] font-bold tabular-nums outline-none placeholder:text-black/20" />
            <Clock3 size={12} strokeWidth={1.8} className="shrink-0 text-black/25" />
          </span>
        </label>}

        {timestampError ? <p role="alert" className="mt-3 rounded-[8px] border border-red-100 bg-red-50/75 px-3 py-2 text-[9px] font-semibold leading-relaxed text-red-700">{timestampError}</p> : null}
        {!hasTimestampPair ? <p className="mt-2 text-[8px] leading-relaxed text-black/30">Bei manueller Erfassung werden keine Start- oder Endzeitstempel gespeichert.</p> : null}
      </section>

      <section className="mt-3 rounded-[14px] border border-white/90 bg-white/75 p-4 shadow-[0_2px_16px_rgba(0,0,0,.05),0_1px_4px_rgba(0,0,0,.03)] backdrop-blur-2xl">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-red-50 text-red-600"><Navigation size={13} strokeWidth={1.8} /></span>
            <div className="min-w-0"><p className="text-[10px] font-bold text-[#1a1a1a]">Fahrtzeit</p><p className="mt-0.5 text-[8px] text-black/30">An- und Abfahrt zum Markt</p></div>
          </div>
          <span className="shrink-0 rounded-full bg-black/[0.04] px-2 py-1 text-[8px] font-bold text-black/35">Optional</span>
        </div>
        {payload.profile.travelTimeEnabled ? <label className="mt-3 flex items-center gap-2.5">
          <span className="w-12 shrink-0 text-[10px] font-semibold text-red-600">Dauer</span>
          <span className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-[8px] bg-black/[0.03] px-3 focus-within:bg-white/80">
            <SmTravelTimeInput value={travelValue} onValueChange={setTravelValue} label="Fahrtzeit" className="h-full min-w-0 flex-1 bg-transparent text-[16px] font-bold tabular-nums outline-none placeholder:text-black/20" />
            <Clock3 size={12} strokeWidth={1.8} className="shrink-0 text-black/25" />
          </span>
        </label> : <p className="mt-3 rounded-[8px] bg-black/[0.025] px-3 py-2.5 text-[9px] font-medium text-black/30">Für diesen Zugang ist keine Fahrtzeiterfassung aktiviert.</p>}
        {travelError ? <p role="alert" className="mt-2 text-[9px] font-semibold text-red-600">{travelError}</p> : null}
      </section>

      {error ? <p role="alert" className="mt-3 rounded-[10px] border border-red-100 bg-red-50/85 px-3 py-3 text-[10px] font-semibold leading-relaxed text-red-700">{error}</p> : null}
    </div>
    {clockTarget ? <ClockPicker
      onSelect={(hour, minute) => {
        const time = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
        const setter = clockTarget === "start" ? setStartValue : setEndValue;
        setter((current) => `${current.split("T")[0] || formatDateKey(new Date())}T${time}`);
        setClockTarget(null);
      }}
      onCancel={() => setClockTarget(null)}
      initialHour={Number((clockTarget === "start" ? startValue : endValue).split("T")[1]?.split(":")[0] || 8)}
      initialMinute={Number((clockTarget === "start" ? startValue : endValue).split("T")[1]?.split(":")[1] || 0)}
    /> : null}
    <button type="button" disabled={busy || missing.length > 0 || timingInvalid || Boolean(travelError)} onClick={() => onSubmit({ ...(hasTimestampPair && startIso && endIso ? { visitStartedAt: startIso, visitCompletedAt: endIso } : {}), ...(payload.profile.travelTimeEnabled ? { travelMinutes } : {}) })} className="fixed bottom-[max(14px,env(safe-area-inset-bottom))] left-1/2 z-20 flex h-9 w-[calc(100%_-_32px)] max-w-[428px] -translate-x-1/2 items-center justify-center gap-1.5 rounded-lg bg-gradient-to-b from-[#DC2626] to-[#b91c1c] text-[11px] font-bold text-white shadow-[inset_0_1px_.6px_rgba(255,255,255,.33),inset_0_-1px_0_rgba(255,255,255,.15),0_0_0_1px_#a91b1b,0_1px_6px_rgba(180,20,20,.18)] disabled:bg-none disabled:bg-black/[0.08] disabled:text-black/25 disabled:shadow-none">{busy ? <LoaderCircle size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}Marktbesuch abschließen</button>
  </main>;
}

function ReviewTimestampField({ label, tone, value, onChange, onOpenClock }: { label: string; tone: "green" | "red"; value: string; onChange: (value: string) => void; onOpenClock: () => void }) {
  const [dateKey = formatDateKey(new Date()), time = ""] = value.split("T");
  return <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
    <span style={{ fontSize: 10, fontWeight: 600, color: tone === "green" ? "#16a34a" : "#DC2626", width: 36, flexShrink: 0 }}>{label}</span>
    <div style={{ flex: 1, display: "flex", alignItems: "center", backgroundColor: "rgba(0,0,0,0.03)", borderRadius: 8, padding: "6px 10px" }}>
      <input type="text" value={time} onChange={(event) => onChange(`${dateKey}T${formatTimeInput(event.target.value)}`)} placeholder="HH:MM" maxLength={5} inputMode="numeric" pattern="[0-9:]*" autoComplete="off" aria-label={`${label}zeit des Marktbesuchs`} style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 700, color: "#1a1a1a", background: "none", border: "none", outline: "none", fontVariantNumeric: "tabular-nums" }} />
      <VisitDatePicker value={dateKey} onChange={(nextDate) => onChange(`${nextDate}T${time}`)} />
      <button type="button" onClick={onOpenClock} aria-label={`${label}zeit auswählen`} style={{ width: 22, height: 22, borderRadius: 6, border: "none", backgroundColor: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Clock size={11} strokeWidth={1.8} color="rgba(0,0,0,0.25)" /></button>
    </div>
  </div>;
}

function ReceiptScreen({ payload, receipt, onDone }: { payload: SmVisitPayload; receipt: SmVisitReceipt | null; onDone: () => void }) {
  const submittedAt = receipt?.submittedAt ?? payload.submission?.submittedAt ?? new Date().toISOString();
  const actualMinutes = receipt?.actualMinutes ?? payload.submission?.actualMinutes ?? null;
  const submittedDate = new Date(submittedAt);
  const market = payload.assignment.market;
  const location = [market.address, [market.postalCode, market.city].filter(Boolean).join(" ")].filter(Boolean).join(" · ");
  const receiptCode = (receipt?.submissionId ?? payload.submission?.id ?? "").slice(0, 8).toUpperCase() || "—";

  return <main className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-[#f5f5f7] px-4 py-[max(24px,env(safe-area-inset-top))] text-[#171717]">
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[58%] opacity-[0.42]">
      <Aurora colorStops={["#D1FAE5", "#10B981", "#A7F3D0"]} blend={0.62} amplitude={0.72} speed={0.28} />
    </div>
    <div aria-hidden="true" className="pointer-events-none absolute -right-20 bottom-[-70px] h-64 w-64 rounded-full bg-emerald-100/40 blur-3xl" />

    <section className="relative w-full max-w-[374px] overflow-hidden rounded-[24px] border border-white/90 bg-white/95 shadow-[0_22px_64px_rgba(15,23,42,.11),0_2px_8px_rgba(15,23,42,.04)] backdrop-blur-xl">
      <div className="px-5 pb-5 pt-6 text-center">
        <span className="relative mx-auto flex h-[58px] w-[58px] items-center justify-center rounded-full border border-emerald-200/80 bg-emerald-50 text-emerald-600 shadow-[0_7px_22px_rgba(5,150,105,.12)]">
          <span aria-hidden="true" className="absolute inset-[5px] rounded-full border border-emerald-100" />
          <CheckCircle2 size={29} strokeWidth={1.8} />
        </span>
        <p className="mt-4 text-[8px] font-bold uppercase tracking-[.15em] text-emerald-600">Erfolgreich gespeichert</p>
        <h1 className="mt-1.5 text-[22px] font-extrabold leading-[1.12] tracking-[-.035em]">Marktbesuch abgeschlossen</h1>
        <p className="mx-auto mt-2 max-w-[270px] text-[11px] leading-[1.5] text-black/40">Alle Angaben für <span className="font-semibold text-black/60">{market.name}</span> wurden sicher übernommen.</p>
      </div>

      <div className="mx-4 overflow-hidden rounded-[16px] border border-black/[0.055] bg-[#fafafa] text-left shadow-[0_1px_2px_rgba(15,23,42,.02)]">
        <div className="grid grid-cols-2 divide-x divide-black/[0.055] border-b border-black/[0.055]">
          <ReceiptMetric
            icon={<Clock3 size={13} strokeWidth={1.8} />}
            label="Besuchszeit"
            value={actualMinutes !== null ? formatMinutes(actualMinutes) : "—"}
          />
          <ReceiptMetric
            icon={<Calendar size={13} strokeWidth={1.8} />}
            label="Abgeschlossen"
            value={new Intl.DateTimeFormat("de-AT", { hour: "2-digit", minute: "2-digit" }).format(submittedDate)}
            detail={new Intl.DateTimeFormat("de-AT", { day: "2-digit", month: "2-digit", year: "numeric" }).format(submittedDate)}
          />
        </div>

        <div className="flex items-start gap-3 px-3.5 py-3.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] border border-red-100 bg-red-50 text-red-600"><Store size={14} strokeWidth={1.8} /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-[8px] font-bold uppercase tracking-[.09em] text-black/30">Markt</span>
            <span className="mt-0.5 block truncate text-[12px] font-bold text-black/75">{market.name}</span>
            {location ? <span className="mt-0.5 block truncate text-[9px] text-black/35">{location}</span> : null}
          </span>
          <span className="mt-0.5 shrink-0 rounded-full bg-white px-2 py-1 font-mono text-[8px] font-semibold tracking-[.04em] text-black/35 shadow-[inset_0_0_0_1px_rgba(0,0,0,.055)]">{market.internalId}</span>
        </div>

        <div className="flex items-center justify-between border-t border-dashed border-black/[0.07] px-3.5 py-2.5">
          <span className="flex items-center gap-1.5 text-[8px] font-semibold uppercase tracking-[.08em] text-black/25"><Check size={10} strokeWidth={2.5} className="text-emerald-500" />Beleg</span>
          <span className="font-mono text-[9px] font-semibold tracking-[.08em] text-black/45">{receiptCode}</span>
        </div>
      </div>

      <div className="px-4 pb-4 pt-4">
        <button type="button" onClick={onDone} className="relative flex h-10 w-full items-center justify-center rounded-[9px] bg-gradient-to-b from-[#DC2626] to-[#b91c1c] text-[11px] font-bold text-white shadow-[inset_0_1px_.6px_rgba(255,255,255,.33),inset_0_-1px_0_rgba(255,255,255,.15),0_0_0_1px_#a91b1b,0_1px_6px_rgba(180,20,20,.18)] transition active:translate-y-px">
          Zurück zum Dashboard
          <ChevronRight size={13} strokeWidth={2} className="absolute right-3.5" />
        </button>
      </div>
    </section>
  </main>;
}

function ReceiptMetric({ icon, label, value, detail }: { icon: ReactNode; label: string; value: string; detail?: string }) {
  return <div className="flex min-h-[76px] items-start gap-2.5 px-3.5 py-3.5">
    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white text-red-500 shadow-[0_1px_3px_rgba(15,23,42,.06),inset_0_0_0_1px_rgba(0,0,0,.045)]">{icon}</span>
    <span className="min-w-0">
      <span className="block text-[7px] font-bold uppercase tracking-[.08em] text-black/25">{label}</span>
      <span className="mt-1 block whitespace-nowrap text-[13px] font-extrabold leading-none tracking-[-.02em] text-black/75">{value}</span>
      {detail ? <span className="mt-1 block whitespace-nowrap text-[8px] text-black/30">{detail}</span> : null}
    </span>
  </div>;
}

function FullPageState({ icon, title, text }: { icon: ReactNode; title: string; text: string }) { return <main className="flex min-h-[100dvh] items-center justify-center bg-[#f5f5f7] px-5 text-center"><div><span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-red-600 shadow-sm">{icon}</span><p className="mt-4 text-[15px] font-bold text-gray-800">{title}</p><p className="mt-2 text-[11px] text-gray-400">{text}</p></div></main>; }
function FullPageError({ message, onBack, onRetry }: { message: string; onBack: () => void; onRetry: () => void }) { return <main className="flex min-h-[100dvh] items-center justify-center bg-[#f5f5f7] px-5 text-center"><section className="w-full max-w-[360px] rounded-2xl bg-white p-5 shadow-sm"><span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600"><AlertCircle size={21} /></span><p className="mt-4 text-[14px] font-bold">Marktbesuch nicht verfügbar</p><p className="mt-2 text-[11px] leading-relaxed text-gray-400">{message}</p><div className="mt-5 grid grid-cols-2 gap-2"><button type="button" onClick={onBack} className="h-11 rounded-xl border border-black/[0.07] text-[11px] font-semibold text-gray-500">Zurück</button><button type="button" onClick={onRetry} className="h-11 rounded-xl bg-red-600 text-[11px] font-bold text-white">Erneut laden</button></div></section></main>; }

function fixtureQuestion(id: string, type: SmVisitQuestion["type"], text: string, config: Record<string, unknown> = {}, options: string[] = []): SmVisitQuestion {
  return { id, questionCode: id, type, text, required: true, config, options: options.map((label, index) => ({ code: `option_${index + 1}`, label })), rules: [], applicable: true, applicabilityReason: null };
}

const EDGE_CASE_QUESTIONS: SmVisitQuestion[] = [
  fixtureQuestion("yesno", "yesno", "Ist die vollständige, gut sichtbare und verkaufsfähige Platzierung nach allen vereinbarten Kriterien umgesetzt?", { images: ["https://picsum.photos/seed/cokeregal/640/420", "https://picsum.photos/seed/cokeregal-detail/640/420"] }, ["Ja, vollständig und ohne Einschränkungen umgesetzt", "Nein, derzeit nicht vollständig umgesetzt"]),
  fixtureQuestion("single", "single", "Welche der folgenden sehr ausführlich beschriebenen Situationen trifft auf die Hauptplatzierung am ehesten zu?", { images: ["https://picsum.photos/seed/aktion/420/560"] }, Array.from({ length: 30 }, (_, index) => `Antwortmöglichkeit ${index + 1}: sehr lange Beschreibung mit zusätzlichem Kontext für kleine Smartphone-Bildschirme`)),
  fixtureQuestion("multiple", "multiple", "Welche Maßnahmen wurden während dieses Besuchs umgesetzt? Bitte alle zutreffenden Punkte auswählen.", {}, Array.from({ length: 20 }, (_, index) => `Maßnahme ${index + 1} mit erklärendem Langtext`)),
  fixtureQuestion("yesnomulti", "yesnomulti", "Wurde eine Abweichung gefunden und falls ja, welche konkreten Ursachen waren erkennbar?", { branches: [{ answer: "Ja", options: Array.from({ length: 20 }, (_, index) => `Ursache ${index + 1}: detaillierte Erläuterung der festgestellten Abweichung`) }] }, ["Ja", "Nein"]),
  fixtureQuestion("likert", "likert", "Wie bewertest du die Gesamtausführung auf einer Skala von null bis zehn?", { min: 0, max: 10, minLabel: "Überhaupt nicht zufriedenstellend und sofort korrekturbedürftig", maxLabel: "Vollständig, hervorragend und ohne weitere Maßnahmen" }, Array.from({ length: 11 }, (_, index) => String(index))),
  fixtureQuestion("text", "text", "Beschreibe alle Beobachtungen vollständig. Zeilenumbrüche, Umlaute, Emoji und sehr lange Texte müssen unverändert erhalten bleiben."),
  fixtureQuestion("numeric", "numeric", "Wie viele verkaufsfähige Einheiten sind aktuell vorhanden?", { min: 0, max: 9999, decimals: false, images: ["https://picsum.photos/seed/facings/520/520"] }),
  fixtureQuestion("slider", "slider", "Wie hoch ist der geschätzte Umsetzungsgrad?", { min: 0, max: 100, step: 5, unit: "%" }),
  fixtureQuestion("photo", "photo", "Fotografiere die gesamte Platzierung so, dass Produkte, Preisschilder und Umfeld gut erkennbar sind.", { instruction: "Bei Bedarf mehrere Fotos aus verschiedenen Blickwinkeln aufnehmen.", images: ["https://picsum.photos/seed/kuehler/640/420", "https://picsum.photos/seed/hygiene/420/560"] }),
  fixtureQuestion("matrix", "matrix", "Bewerte jede Zeile einzeln. Auch lange Zeilen- und Spaltenbezeichnungen müssen auf dem Telefon lesbar bleiben.", { rows: Array.from({ length: 12 }, (_, index) => `Sehr lange Matrixzeile ${index + 1} mit Produkt- und Platzierungsbeschreibung`), columns: Array.from({ length: 8 }, (_, index) => `Bewertung ${index + 1}`) }),
];

const EDGE_CASE_SECTION: SmVisitSection = {
  id: "edge-section",
  code: "edge_section",
  name: "Sehr lang benanntes Modul für die mobile Schnellnavigation",
  description: "Edge-Case-Modul",
  questions: EDGE_CASE_QUESTIONS,
};

type SmVisitTemporaryQuestionnaireProps = {
  assignmentId: string;
  marketName: string;
  marketInternalId: string;
  address: string;
  region: string;
  workDate: string;
};

function splitTemporaryAddress(value: string): { address: string; postalCode: string; city: string } {
  const match = value.match(/^(.*?)(?:\s*[·,]\s*)(\d{4})\s+(.+)$/);
  return match
    ? { address: match[1]!.trim(), postalCode: match[2]!, city: match[3]!.trim() }
    : { address: value, postalCode: "", city: "" };
}

export function SmVisitTemporaryQuestionnaire({ assignmentId, marketName, marketInternalId, address, region, workDate }: SmVisitTemporaryQuestionnaireProps) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, SmVisitAnswer>>({});
  const [photoFiles, setPhotoFiles] = useState<SmVisitPhotoFile[]>([]);
  const [navigatorOpen, setNavigatorOpen] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [startMode, setStartMode] = useState<"timer" | "manual" | null>(null);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [previewCreatedAt] = useState(() => new Date().toISOString());
  const [travelInput, setTravelInput] = useState("");
  const [manualInput, setManualInput] = useState("");
  const [startError, setStartError] = useState<string | null>(null);
  const [exitDialogOpen, setExitDialogOpen] = useState(false);
  const [exitStage, setExitStage] = useState<VisitExitStage>("choice");
  const [exitBusy, setExitBusy] = useState(false);
  const previewUrls = useRef(new Set<string>());
  const flat = useMemo(() => flattenQuestions([EDGE_CASE_SECTION]), []);
  const active = flat[index] ?? flat[0]!;
  const answer = answers[active.question.id] ?? defaultAnswer(active.question);
  const addressParts = useMemo(() => splitTemporaryAddress(address), [address]);

  useEffect(() => () => {
    for (const url of previewUrls.current) URL.revokeObjectURL(url);
  }, []);

  const payload = useMemo<SmVisitPayload>(() => ({
    assignment: {
      id: assignmentId,
      status: "in_progress",
      workDate,
      plannedMinutes: 90,
      market: {
        id: "00000000-0000-4000-8000-000000000002",
        name: marketName,
        internalId: marketInternalId,
        address: addressParts.address,
        postalCode: addressParts.postalCode,
        city: addressParts.city,
        region,
      },
    },
    profile: { name: "Temporärer UI-Check", travelTimeEnabled: true },
    questionnaireAvailability: { count: 1, names: ["Temporärer All-Type-Fragebogen"] },
    submission: startMode ? {
      id: "00000000-0000-4000-8000-000000000003",
      status: "draft",
      questionnaireName: "Temporärer All-Type-Fragebogen",
      questionnaireVersion: 1,
      visitTimeMode: startMode,
      travelMinutes: parseDurationInput(travelInput),
      manualVisitMinutes: null,
      actualMinutes: null,
      visitStartedAt: startedAt,
      visitCompletedAt: null,
      submittedAt: null,
      lastSavedAt: startedAt ?? previewCreatedAt,
      answeredQuestionCount: Object.values(answers).filter(Boolean).length,
      resolvedQuestionCount: flat.length,
    } : null,
    sections: [EDGE_CASE_SECTION],
    answers,
    answerVersions: Object.fromEntries(flat.map(({ question }) => [question.id, answers[question.id] ? 1 : 0])),
    photoFiles: { photo: photoFiles },
  }), [addressParts.address, addressParts.city, addressParts.postalCode, answers, assignmentId, flat.length, marketInternalId, marketName, photoFiles, previewCreatedAt, region, startedAt, startMode, travelInput, workDate]);

  const beginPreview = (mode: "timer" | "manual") => {
    const travelMinutes = parseDurationInput(travelInput);
    if (travelInput && travelMinutes === null) {
      setStartError("Bitte gib die Fahrtzeit als hh:mm ein.");
      return;
    }
    setStartError(null);
    setStartedAt(mode === "timer" ? new Date().toISOString() : null);
    setStartMode(mode);
  };

  const changeAnswer = (next: SmVisitAnswer) => {
    setAnswers((current) => ({ ...current, [active.question.id]: next }));
    setValidationError(null);
  };

  const goNext = () => {
    if (active.question.required && !isCompleteAnswer(active.question, answer)) {
      setValidationError("Bitte beantworte diese Pflichtfrage, bevor du fortfährst.");
      return;
    }
    setValidationError(null);
    if (index >= flat.length - 1) setReviewing(true);
    else setIndex((current) => current + 1);
  };

  const addTemporaryPhotos = (files: File[]) => {
    const additions = files.map((file) => {
      const id = uuid();
      const signedUrl = URL.createObjectURL(file);
      previewUrls.current.add(signedUrl);
      return { id, fileName: file.name, mimeType: file.type, byteSize: file.size, signedUrl } satisfies SmVisitPhotoFile;
    });
    const nextFiles = [...photoFiles, ...additions].slice(0, 20);
    setPhotoFiles(nextFiles);
    setAnswers((current) => ({ ...current, photo: { kind: "photo", fileIds: nextFiles.map((file) => file.id) } }));
    setValidationError(null);
  };

  const deleteTemporaryPhoto = (fileId: string) => {
    const target = photoFiles.find((file) => file.id === fileId);
    if (target?.signedUrl) {
      URL.revokeObjectURL(target.signedUrl);
      previewUrls.current.delete(target.signedUrl);
    }
    const nextFiles = photoFiles.filter((file) => file.id !== fileId);
    setPhotoFiles(nextFiles);
    setAnswers((current) => ({ ...current, photo: { kind: "photo", fileIds: nextFiles.map((file) => file.id) } }));
  };

  const openExitOptions = () => {
    setExitStage("choice");
    setExitDialogOpen(true);
  };

  const leaveTemporaryPreview = () => {
    setExitBusy(true);
    announcePausedVisit(assignmentId, marketName, active.question.id);
    router.replace(`/sm?pausedVisit=${encodeURIComponent(assignmentId)}`);
  };

  const discardTemporaryPreview = () => {
    setExitBusy(true);
    for (const url of previewUrls.current) URL.revokeObjectURL(url);
    previewUrls.current.clear();
    setPhotoFiles([]);
    setAnswers({});
    window.localStorage.removeItem(getSmVisitStartTokenStorageKey(assignmentId));
    router.replace("/sm");
  };

  if (!startMode) return <StartScreen payload={payload} travelInput={travelInput} onTravelInput={(value) => { setTravelInput(value); setStartError(null); }} busy={false} error={startError} onBack={() => router.push("/sm")} onStartTimer={() => beginPreview("timer")} onManual={() => beginPreview("manual")} />;
  if (reviewing) return <ReviewScreen payload={payload} flat={flat} manualInput={manualInput} onManualInput={setManualInput} error={null} busy={false} onBack={() => setReviewing(false)} onSubmit={() => router.replace("/sm")} />;

  return <main className="relative h-[100dvh] overflow-hidden bg-[#f5f5f7] text-gray-900">
    <ActiveQuestionnaireAurora />
    <div className="relative z-10 mx-auto flex h-[100dvh] min-w-0 w-full max-w-[460px] flex-col overflow-hidden bg-transparent">
      <VisitHeader payload={payload} onBack={openExitOptions} />
      <QuestionProgress flat={flat} currentIndex={index} answers={answers} />
      <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto px-4 pb-[calc(64px+env(safe-area-inset-bottom))] pt-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="my-auto w-full shrink-0 py-3">
          <QuestionCard question={active.question} answer={answer} onAnswer={changeAnswer} saveState="saved" saveError={validationError} photoFiles={active.question.type === "photo" ? photoFiles : []} photoBusy={false} onPhotoUpload={addTemporaryPhotos} onPhotoDelete={deleteTemporaryPhoto} questionNumber={index + 1} questionCount={flat.length} previousDisabled={index === 0} nextLabel={index === flat.length - 1 ? "Zur Übersicht" : "Weiter"} onPrevious={() => { setIndex((current) => Math.max(0, current - 1)); setValidationError(null); }} onNext={goNext} />
        </div>
      </section>
      <QuickNavigationFlap sectionName={active.section.name} questionText={active.question.text} currentIndex={index} questionCount={flat.length} answeredCount={flat.filter(({ question }) => isCompleteAnswer(question, answers[question.id])).length} onOpen={() => setNavigatorOpen(true)} />
    </div>
    {navigatorOpen && typeof document !== "undefined" ? createPortal(<QuickNavigator sections={[EDGE_CASE_SECTION]} currentQuestionId={active.question.id} answers={answers} onClose={() => setNavigatorOpen(false)} onSelect={(questionId) => { const nextIndex = flat.findIndex((entry) => entry.question.id === questionId); if (nextIndex >= 0) setIndex(nextIndex); setValidationError(null); setNavigatorOpen(false); }} />, document.body) : null}
    <VisitExitDialog open={exitDialogOpen} stage={exitStage} busy={exitBusy} error={null} onOpenChange={setExitDialogOpen} onStageChange={setExitStage} onContinueLater={leaveTemporaryPreview} onDiscard={discardTemporaryPreview} />
  </main>;
}
