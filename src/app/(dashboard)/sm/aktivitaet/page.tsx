"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock,
  FilePenLine,
  Home,
  Image as ImageIcon,
  Inbox,
  Loader2,
  LogOut,
  MapPin,
  RefreshCw,
  Search,
  Send,
  Store,
  Trash2,
  User,
  X,
} from "lucide-react";
import {
  CollapsibleMenu,
  type MenuItem,
} from "@/components/ui/CollapsibleMenu";
import {
  fetchMySmActivityRequests,
  fetchMySmCompletedActivities,
  fetchSmVisit,
  logoutCurrentUser,
  requestMySmActivityAnswerChange,
  requestMySmActivitySubmissionDelete,
} from "@/lib/api/backend";
import type {
  SmActivityAnswerChangeRequest,
  SmActivitySubmissionDeleteRequest,
  SmCompletedActivitySummary,
  SmRequestStatus,
} from "@/types/smActivity";
import type {
  SmVisitAnswer,
  SmVisitPayload,
  SmVisitQuestion,
} from "@/types/smVisit";

const RED = "#dc2626";
const GREEN = "#059669";
const AMBER = "#d97706";

const MENU_ITEMS: MenuItem[] = [
  { label: "Home", href: "/sm", icon: <Home size={11} strokeWidth={1.8} /> },
  {
    label: "Aktivitäten",
    href: "/sm/aktivitaet",
    icon: <Activity size={11} strokeWidth={1.8} />,
  },
  {
    label: "Zeiterfassung",
    href: "/sm/zeiterfassung",
    icon: <Clock size={11} strokeWidth={1.8} />,
  },
  {
    label: "Profil",
    href: "/sm/profil",
    icon: <User size={11} strokeWidth={1.8} />,
  },
  {
    label: "Logout",
    icon: <LogOut size={11} strokeWidth={1.9} />,
    action: "logout",
    tone: "danger",
  },
];

function duration(minutes: number | null) {
  if (minutes == null) return "—";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest} Min`;
  return rest
    ? `${hours} h ${String(rest).padStart(2, "0")} min`
    : `${hours} h`;
}

function formatDate(value: string | null | undefined, withTime = false) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(
    "de-AT",
    withTime
      ? {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }
      : { day: "2-digit", month: "2-digit", year: "numeric" },
  ).format(date);
}

function statusLabel(status: SmRequestStatus) {
  if (status === "pending") return "In Prüfung";
  if (status === "approved") return "Freigegeben";
  if (status === "rejected") return "Abgelehnt";
  return "Storniert";
}

function defaultAnswer(
  question: SmVisitQuestion,
  current: SmVisitAnswer | null | undefined,
): SmVisitAnswer {
  if (current) return current;
  if (["yesno", "single", "likert"].includes(question.type))
    return { kind: "choice", optionCode: "" };
  if (question.type === "multiple") return { kind: "multi", optionCodes: [] };
  if (question.type === "yesnomulti")
    return { kind: "yesnomulti", optionCode: "", subOptions: [] };
  if (question.type === "numeric" || question.type === "slider")
    return { kind: "number", value: Number(question.config.min ?? 0) };
  if (question.type === "matrix") return { kind: "matrix", cells: [] };
  if (question.type === "photo") return { kind: "photo", fileIds: [] };
  return { kind: "text", value: "" };
}

function answerText(
  question: SmVisitQuestion,
  answer: SmVisitAnswer | null | undefined,
) {
  if (!answer || answer.kind === "empty") return "Keine Antwort";
  const label = (code: string) =>
    question.options.find((option) => option.code === code)?.label ?? code;
  if (answer.kind === "choice") return label(answer.optionCode);
  if (answer.kind === "multi")
    return answer.optionCodes.map(label).join(", ") || "Keine Auswahl";
  if (answer.kind === "yesnomulti")
    return [label(answer.optionCode), ...answer.subOptions]
      .filter(Boolean)
      .join(": ");
  if (answer.kind === "text") return answer.value || "Kein Text";
  if (answer.kind === "number") return String(answer.value);
  if (answer.kind === "matrix")
    return `${answer.cells.filter((cell) => cell.selected).length} Auswahl${answer.cells.filter((cell) => cell.selected).length === 1 ? "" : "en"}`;
  return `${answer.fileIds.length} Foto${answer.fileIds.length === 1 ? "" : "s"}`;
}

function isMeaningful(question: SmVisitQuestion, answer: SmVisitAnswer) {
  if (answer.kind === "empty") return !question.required;
  if (answer.kind === "choice") return Boolean(answer.optionCode);
  if (answer.kind === "multi")
    return answer.optionCodes.length > 0 || !question.required;
  if (answer.kind === "yesnomulti") return Boolean(answer.optionCode);
  if (answer.kind === "text")
    return Boolean(answer.value.trim()) || !question.required;
  if (answer.kind === "matrix") {
    if (!question.required) return true;
    const rows = Array.isArray(question.config.rows)
      ? question.config.rows
      : [];
    const selectedRows = new Set(
      answer.cells.filter((cell) => cell.selected).map((cell) => cell.rowCode),
    );
    return (
      rows.length > 0 &&
      rows.every((_row, index) => selectedRows.has(`row_${index + 1}`))
    );
  }
  if (answer.kind === "photo")
    return answer.fileIds.length > 0 || !question.required;
  return true;
}

function requestForQuestion(
  requests: SmActivityAnswerChangeRequest[],
  submissionId: string,
  questionId: string,
) {
  return (
    requests.find(
      (request) =>
        request.submissionId === submissionId &&
        request.submissionQuestionId === questionId,
    ) ?? null
  );
}

function originalRequestAnswerText(request: SmActivityAnswerChangeRequest) {
  const value = request.originalAnswerSnapshot.value;
  if (!value || typeof value !== "object") return "Keine Antwort";
  const answer = value as SmVisitAnswer;
  const label = (code: string) =>
    request.questionOptions.find((option) => option.code === code)?.label ??
    code;
  if (answer.kind === "empty") return "Keine Antwort";
  if (answer.kind === "choice") return label(answer.optionCode);
  if (answer.kind === "multi")
    return answer.optionCodes.map(label).join(", ") || "Keine Auswahl";
  if (answer.kind === "yesnomulti")
    return [label(answer.optionCode), ...answer.subOptions]
      .filter(Boolean)
      .join(": ");
  if (answer.kind === "text") return answer.value || "Kein Text";
  if (answer.kind === "number") return String(answer.value);
  if (answer.kind === "matrix")
    return `${answer.cells.filter((cell) => cell.selected).length} Matrixwerte`;
  return `${answer.fileIds.length} Foto${answer.fileIds.length === 1 ? "" : "s"}`;
}

function RequestStatus({
  status,
  note,
}: {
  status: SmRequestStatus;
  note?: string | null;
}) {
  return (
    <div className={`sm-act-request-status is-${status}`}>
      <span>{statusLabel(status)}</span>
      {note ? <p>Admin: {note}</p> : null}
    </div>
  );
}

function ReadOnlyAnswer({
  question,
  answer,
  photos,
}: {
  question: SmVisitQuestion;
  answer: SmVisitAnswer | null | undefined;
  photos: SmVisitPayload["photoFiles"][string];
}) {
  if (!answer || answer.kind === "empty")
    return (
      <div className="sm-act-answer-empty">Keine Antwort gespeichert.</div>
    );
  if (answer.kind === "photo")
    return photos.length ? (
      <div className="sm-act-photo-grid">
        {photos.map((photo) => (
          <div key={photo.id}>
            {photo.signedUrl ? (
              <img
                src={photo.signedUrl}
                alt={photo.fileName || "Besuchsfoto"}
              />
            ) : (
              <ImageIcon size={16} />
            )}
          </div>
        ))}
      </div>
    ) : (
      <div className="sm-act-answer-empty">Keine Fotos verfügbar.</div>
    );
  if (answer.kind === "matrix") {
    const selected = answer.cells.filter((cell) => cell.selected);
    return (
      <div className="sm-act-answer-chips">
        {selected.length ? (
          selected.map((cell) => (
            <span key={`${cell.rowCode}:${cell.columnCode}`}>
              {cell.rowCode.replace("row_", "Zeile ")} ·{" "}
              {cell.columnCode.replace("column_", "Spalte ")}
            </span>
          ))
        ) : (
          <span>Keine Auswahl</span>
        )}
      </div>
    );
  }
  if (
    answer.kind === "choice" ||
    answer.kind === "multi" ||
    answer.kind === "yesnomulti"
  ) {
    const values =
      answer.kind === "choice"
        ? [answer.optionCode]
        : answer.kind === "multi"
          ? answer.optionCodes
          : [answer.optionCode, ...answer.subOptions];
    return (
      <div className="sm-act-answer-chips">
        {values.filter(Boolean).map((value) => (
          <span key={value}>
            <Check size={8} />
            {question.options.find((option) => option.code === value)?.label ??
              value}
          </span>
        ))}
      </div>
    );
  }
  return (
    <div className="sm-act-answer-text">
      {answer.kind === "text"
        ? answer.value
        : answer.kind === "number"
          ? answer.value
          : answerText(question, answer)}
    </div>
  );
}

function AnswerEditor({
  question,
  answer,
  photos,
  onChange,
}: {
  question: SmVisitQuestion;
  answer: SmVisitAnswer;
  photos: SmVisitPayload["photoFiles"][string];
  onChange: (answer: SmVisitAnswer) => void;
}) {
  if (["yesno", "single", "likert"].includes(question.type)) {
    const current = answer.kind === "choice" ? answer.optionCode : "";
    return (
      <div className="sm-act-edit-options">
        {question.options.map((option) => (
          <button
            type="button"
            key={option.code}
            className={current === option.code ? "selected" : ""}
            onClick={() =>
              onChange({ kind: "choice", optionCode: option.code })
            }
          >
            {current === option.code ? <Check size={9} /> : null}
            {option.label}
          </button>
        ))}
      </div>
    );
  }
  if (question.type === "multiple") {
    const current = answer.kind === "multi" ? answer.optionCodes : [];
    return (
      <div className="sm-act-edit-options">
        {question.options.map((option) => (
          <button
            type="button"
            key={option.code}
            className={current.includes(option.code) ? "selected" : ""}
            onClick={() =>
              onChange({
                kind: "multi",
                optionCodes: current.includes(option.code)
                  ? current.filter((code) => code !== option.code)
                  : [...current, option.code],
              })
            }
          >
            {current.includes(option.code) ? <Check size={9} /> : null}
            {option.label}
          </button>
        ))}
      </div>
    );
  }
  if (question.type === "yesnomulti") {
    const current =
      answer.kind === "yesnomulti"
        ? answer
        : { kind: "yesnomulti" as const, optionCode: "", subOptions: [] };
    const selectedLabel =
      question.options.find((option) => option.code === current.optionCode)
        ?.label ?? "";
    const branches = Array.isArray(question.config.branches)
      ? question.config.branches.filter(
          (entry): entry is Record<string, unknown> =>
            Boolean(entry) && typeof entry === "object",
        )
      : [];
    const branch = branches.find((entry) => entry.answer === selectedLabel);
    const subOptions = Array.isArray(branch?.options)
      ? branch.options.filter(
          (entry): entry is string => typeof entry === "string",
        )
      : [];
    return (
      <div className="sm-act-ynm">
        <div className="sm-act-edit-options">
          {question.options.map((option) => (
            <button
              type="button"
              key={option.code}
              className={current.optionCode === option.code ? "selected" : ""}
              onClick={() =>
                onChange({
                  kind: "yesnomulti",
                  optionCode: option.code,
                  subOptions: [],
                })
              }
            >
              {option.label}
            </button>
          ))}
        </div>
        {subOptions.length ? (
          <div className="sm-act-edit-options is-sub">
            {subOptions.map((option) => (
              <button
                type="button"
                key={option}
                className={
                  current.subOptions.includes(option) ? "selected" : ""
                }
                onClick={() =>
                  onChange({
                    ...current,
                    subOptions: current.subOptions.includes(option)
                      ? current.subOptions.filter((value) => value !== option)
                      : [...current.subOptions, option],
                  })
                }
              >
                {current.subOptions.includes(option) ? (
                  <Check size={8} />
                ) : null}
                {option}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    );
  }
  if (question.type === "numeric")
    return (
      <input
        className="sm-act-edit-input"
        type="number"
        value={answer.kind === "number" ? answer.value : ""}
        onChange={(event) =>
          onChange({ kind: "number", value: Number(event.target.value) })
        }
      />
    );
  if (question.type === "slider") {
    const min = Number(question.config.min ?? 0);
    const max = Number(question.config.max ?? 100);
    const step = Number(question.config.step ?? 1);
    const value = answer.kind === "number" ? answer.value : min;
    return (
      <div className="sm-act-slider">
        <strong>{value}</strong>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) =>
            onChange({ kind: "number", value: Number(event.target.value) })
          }
        />
        <div>
          <span>{min}</span>
          <span>{max}</span>
        </div>
      </div>
    );
  }
  if (question.type === "matrix") {
    const rows = Array.isArray(question.config.rows)
      ? question.config.rows.filter(
          (row): row is string => typeof row === "string",
        )
      : [];
    const columns = Array.isArray(question.config.columns)
      ? question.config.columns.filter(
          (column): column is string => typeof column === "string",
        )
      : [];
    const cells = answer.kind === "matrix" ? answer.cells : [];
    return (
      <div
        className="sm-act-matrix"
        style={{ "--matrix-columns": columns.length } as React.CSSProperties}
      >
        <div className="head">
          <span />
          {columns.map((column) => (
            <span key={column}>{column}</span>
          ))}
        </div>
        {rows.map((row, rowIndex) => (
          <div key={row}>
            <strong>{row}</strong>
            {columns.map((_column, columnIndex) => {
              const rowCode = `row_${rowIndex + 1}`;
              const columnCode = `column_${columnIndex + 1}`;
              const selected = cells.some(
                (cell) =>
                  cell.rowCode === rowCode &&
                  cell.columnCode === columnCode &&
                  cell.selected,
              );
              return (
                <button
                  type="button"
                  key={columnCode}
                  className={selected ? "selected" : ""}
                  onClick={() =>
                    onChange({
                      kind: "matrix",
                      cells: [
                        ...cells.filter((cell) => cell.rowCode !== rowCode),
                        { rowCode, columnCode, selected: true },
                      ],
                    })
                  }
                >
                  {selected ? <Check size={9} /> : null}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    );
  }
  if (question.type === "photo") {
    const selected = new Set(answer.kind === "photo" ? answer.fileIds : []);
    return (
      <>
        <p className="sm-act-photo-help">
          Wähle die Fotos, die in der korrigierten Antwort erhalten bleiben
          sollen. Neue Fotos können hier nicht angehängt werden.
        </p>
        <div className="sm-act-photo-grid is-edit">
          {photos.map((photo) => (
            <button
              type="button"
              key={photo.id}
              className={selected.has(photo.id) ? "selected" : ""}
              onClick={() => {
                const next = new Set(selected);
                if (next.has(photo.id)) next.delete(photo.id);
                else next.add(photo.id);
                onChange({ kind: "photo", fileIds: [...next] });
              }}
            >
              {photo.signedUrl ? (
                <img
                  src={photo.signedUrl}
                  alt={photo.fileName || "Besuchsfoto"}
                />
              ) : (
                <ImageIcon size={16} />
              )}
              <span>{selected.has(photo.id) ? <Check size={10} /> : null}</span>
            </button>
          ))}
        </div>
      </>
    );
  }
  return (
    <textarea
      className="sm-act-edit-textarea"
      value={answer.kind === "text" ? answer.value : ""}
      onChange={(event) =>
        onChange({ kind: "text", value: event.target.value })
      }
      placeholder="Gewünschte Antwort eingeben …"
    />
  );
}

function ChangeRequestSheet({
  summary,
  question,
  currentAnswer,
  photos,
  existing,
  onClose,
  onSaved,
}: {
  summary: SmCompletedActivitySummary;
  question: SmVisitQuestion;
  currentAnswer: SmVisitAnswer | null;
  photos: SmVisitPayload["photoFiles"][string];
  existing: SmActivityAnswerChangeRequest | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const pendingRequest = existing?.status === "pending" ? existing : null;
  const [answer, setAnswer] = useState<SmVisitAnswer>(() =>
    defaultAnswer(question, currentAnswer),
  );
  const [reason, setReason] = useState("");
  const [token] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const unchanged =
    JSON.stringify(answer) ===
    JSON.stringify(currentAnswer ?? { kind: "empty" });
  useEffect(() => {
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = old;
    };
  }, []);
  const submit = async () => {
    if (pendingRequest || busy) return;
    if (!isMeaningful(question, answer)) {
      setError(
        question.required
          ? "Diese Pflichtfrage braucht eine vollständige Antwort."
          : "Bitte gib eine gültige Antwort ein.",
      );
      return;
    }
    if (unchanged) {
      setError("Bitte ändere die Antwort, bevor du die Anfrage sendest.");
      return;
    }
    if (reason.trim().length < 2) {
      setError("Bitte gib einen kurzen Grund für die Änderung an.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await requestMySmActivityAnswerChange({
        submissionId: summary.submissionId,
        submissionQuestionId: question.id,
        answer,
        requestedAnswerSummary: answerText(question, answer),
        reason: reason.trim(),
        clientRequestToken: token,
      });
      await onSaved();
      onClose();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Die Anfrage konnte nicht gespeichert werden.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="sm-act-modal-backdrop">
      <section className="sm-act-sheet" role="dialog" aria-modal="true">
        <header>
          <div>
            <span>Antwortkorrektur</span>
            <h3>{pendingRequest ? "Anfrage ansehen" : "Änderung anfragen"}</h3>
          </div>
          <button type="button" onClick={onClose}>
            <X size={14} />
          </button>
        </header>
        <div className="sm-act-sheet-body">
          <div className="sm-act-context">
            <Store size={13} />
            <div>
              <strong>{summary.market.name}</strong>
              <span>{summary.questionnaireName}</span>
            </div>
          </div>
          <div className="sm-act-question-copy">
            <small>{question.required ? "Pflichtfrage" : "Optional"}</small>
            <strong>{question.text}</strong>
            <p>Aktuell: {answerText(question, currentAnswer)}</p>
          </div>
          {pendingRequest ? (
            <>
              <RequestStatus
                status={pendingRequest.status}
                note={pendingRequest.adminNote}
              />
              <div className="sm-act-request-existing">
                <small>Gewünschte Antwort</small>
                <strong>{pendingRequest.requestedAnswerSummary}</strong>
                <p>{pendingRequest.requestReason}</p>
              </div>
            </>
          ) : (
            <>
              <label className="sm-act-field">
                <span>Gewünschte Antwort</span>
                <AnswerEditor
                  question={question}
                  answer={answer}
                  photos={photos}
                  onChange={setAnswer}
                />
                {!question.required && answer.kind !== "empty" ? (
                  <button
                    type="button"
                    className="sm-act-clear-answer"
                    onClick={() => setAnswer({ kind: "empty" })}
                  >
                    Antwort entfernen
                  </button>
                ) : null}
              </label>
              <label className="sm-act-field">
                <span>Grund für die Änderung</span>
                <textarea
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  maxLength={2000}
                  placeholder="Kurz erklären, warum die Antwort korrigiert werden soll …"
                />
              </label>
            </>
          )}
          {error ? (
            <div className="sm-act-error">
              <AlertCircle size={12} />
              {error}
            </div>
          ) : null}
        </div>
        <footer>
          <button type="button" className="secondary" onClick={onClose}>
            Schließen
          </button>
          {!pendingRequest ? (
            <button
              type="button"
              className="primary"
              onClick={() => void submit()}
              disabled={busy || unchanged || reason.trim().length < 2}
            >
              {busy ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Send size={12} />
              )}
              Anfrage senden
            </button>
          ) : null}
        </footer>
      </section>
    </div>
  );
}

function DeleteRequestSheet({
  summary,
  existing,
  onClose,
  onSaved,
}: {
  summary: SmCompletedActivitySummary;
  existing: SmActivitySubmissionDeleteRequest | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const pendingRequest = existing?.status === "pending" ? existing : null;
  const [reason, setReason] = useState("");
  const [token] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = old;
    };
  }, []);
  const submit = async () => {
    if (busy || pendingRequest) return;
    if (reason.trim().length < 2) {
      setError("Bitte gib einen kurzen Grund an.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await requestMySmActivitySubmissionDelete({
        submissionId: summary.submissionId,
        reason: reason.trim(),
        clientRequestToken: token,
      });
      await onSaved();
      onClose();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Die Löschanfrage konnte nicht gespeichert werden.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="sm-act-modal-backdrop">
      <section className="sm-act-sheet" role="dialog" aria-modal="true">
        <header>
          <div>
            <span>Fragebogen</span>
            <h3>Löschung anfragen</h3>
          </div>
          <button type="button" onClick={onClose}>
            <X size={14} />
          </button>
        </header>
        <div className="sm-act-sheet-body">
          <div className="sm-act-delete-warning">
            <Trash2 size={14} />
            <div>
              <strong>
                {pendingRequest
                  ? "Löschanfrage"
                  : "Nur diesen Fragebogen entfernen"}
              </strong>
              <p>
                Einsatz, Planung, Soll-/Ist-Zeit und Pauschale bleiben
                unverändert. Erst eine Admin-Freigabe entfernt diese
                Einreichung.
              </p>
            </div>
          </div>
          {pendingRequest ? (
            <>
              <RequestStatus
                status={pendingRequest.status}
                note={pendingRequest.adminNote}
              />
              <div className="sm-act-request-existing">
                <small>Grund</small>
                <p>{pendingRequest.requestReason}</p>
              </div>
            </>
          ) : (
            <label className="sm-act-field">
              <span>Grund</span>
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                maxLength={2000}
                placeholder="Warum soll dieser Fragebogen entfernt werden?"
              />
            </label>
          )}
          {error ? (
            <div className="sm-act-error">
              <AlertCircle size={12} />
              {error}
            </div>
          ) : null}
        </div>
        <footer>
          <button type="button" className="secondary" onClick={onClose}>
            Schließen
          </button>
          {!pendingRequest ? (
            <button
              type="button"
              className="primary danger"
              disabled={busy || reason.trim().length < 2}
              onClick={() => void submit()}
            >
              {busy ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Trash2 size={12} />
              )}
              Anfrage senden
            </button>
          ) : null}
        </footer>
      </section>
    </div>
  );
}

function RequestHistoryModal({
  answerRequests,
  deleteRequests,
  onClose,
  onRefresh,
}: {
  answerRequests: SmActivityAnswerChangeRequest[];
  deleteRequests: SmActivitySubmissionDeleteRequest[];
  onClose: () => void;
  onRefresh: () => Promise<void>;
}) {
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const entries = useMemo(
    () =>
      [
        ...answerRequests.map((request) => ({
          kind: "answer" as const,
          request,
        })),
        ...deleteRequests.map((request) => ({
          kind: "delete" as const,
          request,
        })),
      ].sort(
        (left, right) =>
          new Date(right.request.updatedAt).getTime() -
          new Date(left.request.updatedAt).getTime(),
      ),
    [answerRequests, deleteRequests],
  );

  useEffect(() => {
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = old;
    };
  }, []);

  const refresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    setRefreshError(null);
    try {
      await onRefresh();
    } catch (cause) {
      setRefreshError(
        cause instanceof Error
          ? cause.message
          : "Die Anfragen konnten nicht aktualisiert werden.",
      );
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="sm-act-modal-backdrop">
      <section
        className="sm-act-history"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sm-activity-history-title"
      >
        <header>
          <div>
            <span>Änderungen</span>
            <h2 id="sm-activity-history-title">Anfragehistorie</h2>
            <p>Korrekturen, Löschungen und der aktuelle Prüfstatus.</p>
          </div>
          <div>
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={refreshing}
              aria-label="Anfragen aktualisieren"
            >
              <RefreshCw
                size={13}
                className={refreshing ? "animate-spin" : ""}
              />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Anfragehistorie schließen"
            >
              <X size={13} />
            </button>
          </div>
        </header>
        {refreshError ? (
          <div className="sm-act-history-error">
            <AlertCircle size={12} />
            {refreshError}
          </div>
        ) : null}
        <div className="sm-act-history-list">
          {entries.length ? (
            entries.map((entry) => {
              const request = entry.request;
              return (
                <article
                  key={`${entry.kind}:${request.id}`}
                  className={`sm-act-history-card is-${request.status}`}
                >
                  <div className="sm-act-history-card-top">
                    <span>
                      {entry.kind === "answer" ? (
                        <FilePenLine size={10} />
                      ) : (
                        <Trash2 size={10} />
                      )}
                      {entry.kind === "answer" ? "Antwort" : "Fragebogen"}
                    </span>
                    <strong>{statusLabel(request.status)}</strong>
                  </div>
                  <h3>
                    {entry.kind === "answer"
                      ? entry.request.questionText
                      : entry.request.questionnaireName}
                  </h3>
                  <p className="sm-act-history-context">
                    {request.market.name} · {formatDate(request.updatedAt, true)}
                  </p>
                  {entry.kind === "answer" ? (
                    <div className="sm-act-history-diff">
                      <span>{originalRequestAnswerText(entry.request)}</span>
                      <ChevronRight size={11} />
                      <strong>{entry.request.requestedAnswerSummary}</strong>
                    </div>
                  ) : (
                    <div className="sm-act-history-delete-copy">
                      Nur diese Fragebogen-Einreichung entfernen; Einsatz und
                      Zeit bleiben erhalten.
                    </div>
                  )}
                  <p className="sm-act-history-reason">{request.requestReason}</p>
                  {request.adminNote ? (
                    <p className="sm-act-history-note">
                      Admin: {request.adminNote}
                    </p>
                  ) : null}
                </article>
              );
            })
          ) : (
            <div className="sm-act-history-empty">
              <Inbox size={21} />
              <strong>Noch keine Anfragen</strong>
              <span>Deine Änderungsanfragen erscheinen hier dauerhaft.</span>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function ActivityViewer({
  summary,
  payload,
  loading,
  error,
  answerRequests,
  deleteRequest,
  onClose,
  onRetry,
  onQuestion,
  onDelete,
}: {
  summary: SmCompletedActivitySummary;
  payload: SmVisitPayload | null;
  loading: boolean;
  error: string | null;
  answerRequests: SmActivityAnswerChangeRequest[];
  deleteRequest: SmActivitySubmissionDeleteRequest | null;
  onClose: () => void;
  onRetry: () => void;
  onQuestion: (question: SmVisitQuestion) => void;
  onDelete: () => void;
}) {
  useEffect(() => {
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = old;
    };
  }, []);
  return (
    <div className="sm-act-viewer-backdrop">
      <section className="sm-act-viewer">
        <header className="sm-act-viewer-head">
          <button type="button" onClick={onClose}>
            <ArrowLeft size={14} />
          </button>
          <div>
            <span>{summary.questionnaireName}</span>
            <h2>{summary.market.name}</h2>
          </div>
          <button type="button" onClick={onClose}>
            <X size={14} />
          </button>
        </header>
        <div className="sm-act-viewer-meta">
          <div>
            <MapPin size={11} />
            {[
              summary.market.address,
              summary.market.postalCode,
              summary.market.city,
            ]
              .filter(Boolean)
              .join(" · ")}
          </div>
          <div>
            <Clock size={11} />
            Abgeschlossen {formatDate(summary.submittedAt, true)}
          </div>
        </div>
        <div className="sm-act-delete-bar">
          <div>
            <Trash2 size={12} />
            <span>
              {deleteRequest?.status === "pending"
                ? "Löschanfrage in Prüfung"
                : "Falschen Fragebogen eingereicht?"}
            </span>
          </div>
          <button
            type="button"
            className={deleteRequest?.status === "pending" ? "pending" : ""}
            onClick={onDelete}
          >
            {deleteRequest?.status === "pending"
              ? statusLabel(deleteRequest.status)
              : deleteRequest
                ? "Erneut anfragen"
                : "Löschung anfragen"}
          </button>
        </div>
        <div className="sm-act-viewer-strip">
          <div>
            <span>Ist / Soll</span>
            <strong>
              {duration(summary.actualMinutes)} /{" "}
              {duration(summary.plannedMinutes)}
            </strong>
          </div>
          <div>
            <span>Fragen</span>
            <strong>
              {summary.totals.answeredCount}/{summary.totals.questionCount}
            </strong>
          </div>
          <div>
            <span>Fotos</span>
            <strong>{summary.totals.photoCount}</strong>
          </div>
        </div>
        {loading ? (
          <div className="sm-act-view-state">
            <Loader2 size={18} className="animate-spin" />
            <strong>Fragebogen wird geladen</strong>
          </div>
        ) : error ? (
          <div className="sm-act-view-state is-error">
            <AlertCircle size={18} />
            <strong>Fragebogen konnte nicht geladen werden</strong>
            <span>{error}</span>
            <button type="button" onClick={onRetry}>
              <RefreshCw size={11} />
              Erneut versuchen
            </button>
          </div>
        ) : payload ? (
          <div className="sm-act-question-list">
            {payload.sections.map((section) => (
              <section key={section.id} className="sm-act-module">
                <header>
                  <span>{section.name}</span>
                  <small>
                    {
                      section.questions.filter(
                        (question) => question.applicable,
                      ).length
                    }{" "}
                    Fragen
                  </small>
                </header>
                {section.questions
                  .filter((question) => question.applicable)
                  .map((question, index) => {
                    const request = requestForQuestion(
                      answerRequests,
                      summary.submissionId,
                      question.id,
                    );
                    return (
                      <article
                        key={question.id}
                        className="sm-act-question-card"
                      >
                        <div className="sm-act-question-meta">
                          <span>{index + 1}</span>
                          <small>
                            {question.required ? "Pflichtfrage" : "Optional"}
                          </small>
                        </div>
                        <h3>{question.text}</h3>
                        <ReadOnlyAnswer
                          question={question}
                          answer={payload.answers[question.id]}
                          photos={payload.photoFiles[question.id] ?? []}
                        />
                        {request ? (
                          <RequestStatus
                            status={request.status}
                            note={request.adminNote}
                          />
                        ) : null}
                        <div className="sm-act-question-action">
                          <button
                            type="button"
                            className={
                              request?.status === "pending" ? "pending" : ""
                            }
                            onClick={() => onQuestion(question)}
                          >
                            {request?.status === "pending" ? (
                              <Clock size={10} />
                            ) : (
                              <FilePenLine size={10} />
                            )}
                            {request?.status === "pending"
                              ? statusLabel(request.status)
                              : request
                                ? "Erneut anfragen"
                                : "Änderung anfragen"}
                          </button>
                        </div>
                      </article>
                    );
                  })}
              </section>
            ))}
          </div>
        ) : null}
        <footer className="sm-act-viewer-footer">
          <button type="button" onClick={onClose}>
            Schließen
          </button>
          <span>
            <CheckCircle2 size={11} />
            Read-only
          </span>
        </footer>
      </section>
    </div>
  );
}

export default function SmActivityPage() {
  const router = useRouter();
  const [activities, setActivities] = useState<SmCompletedActivitySummary[]>(
    [],
  );
  const [answerRequests, setAnswerRequests] = useState<
    SmActivityAnswerChangeRequest[]
  >([]);
  const [deleteRequests, setDeleteRequests] = useState<
    SmActivitySubmissionDeleteRequest[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "requests">("all");
  const [selected, setSelected] = useState<SmCompletedActivitySummary | null>(
    null,
  );
  const [payload, setPayload] = useState<SmVisitPayload | null>(null);
  const [payloadLoading, setPayloadLoading] = useState(false);
  const [payloadError, setPayloadError] = useState<string | null>(null);
  const [selectedQuestion, setSelectedQuestion] =
    useState<SmVisitQuestion | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const loadRequests = useCallback(async () => {
    const next = await fetchMySmActivityRequests();
    setAnswerRequests(next.answerRequests);
    setDeleteRequests(next.deleteRequests);
  }, []);
  const loadActivities = useCallback(async () => {
    const next = await fetchMySmCompletedActivities();
    setActivities(next);
    return next;
  }, []);
  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextActivities, nextRequests] = await Promise.all([
        loadActivities(),
        fetchMySmActivityRequests(),
      ]);
      setAnswerRequests(nextRequests.answerRequests);
      setDeleteRequests(nextRequests.deleteRequests);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Aktivitäten konnten nicht geladen werden.",
      );
    } finally {
      setLoading(false);
    }
  }, [loadActivities]);
  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const loadPayload = useCallback(
    async (activity: SmCompletedActivitySummary) => {
      setPayloadLoading(true);
      setPayloadError(null);
      try {
        setPayload(await fetchSmVisit(activity.assignmentId));
      } catch (cause) {
        setPayload(null);
        setPayloadError(
          cause instanceof Error
            ? cause.message
            : "Fragebogen konnte nicht geladen werden.",
        );
      } finally {
        setPayloadLoading(false);
      }
    },
    [],
  );
  const refreshRequestsAndPayload = useCallback(async () => {
    const [nextActivities] = await Promise.all([
      loadActivities(),
      loadRequests(),
      ...(selected ? [loadPayload(selected)] : []),
    ]);
    if (selected && !nextActivities.some((activity) => activity.submissionId === selected.submissionId)) {
      setSelected(null);
      setPayload(null);
      setSelectedQuestion(null);
      setDeleteOpen(false);
    }
  }, [loadActivities, loadPayload, loadRequests, selected]);
  useEffect(() => {
    const refresh = () => {
      void refreshRequestsAndPayload().catch(() => {
        // Keep the last known archive visible; explicit refresh surfaces errors.
      });
    };
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [refreshRequestsAndPayload]);
  const openActivity = (activity: SmCompletedActivitySummary) => {
    setSelected(activity);
    setPayload(null);
    void loadPayload(activity);
  };
  const pendingAnswerRequests = answerRequests.filter(
    (request) => request.status === "pending",
  );
  const pendingDeleteRequests = deleteRequests.filter(
    (request) => request.status === "pending",
  );
  const requestCount =
    pendingAnswerRequests.length + pendingDeleteRequests.length;
  const pendingBySubmission = useMemo(() => {
    const map = new Map<string, number>();
    for (const request of [...pendingAnswerRequests, ...pendingDeleteRequests])
      map.set(request.submissionId, (map.get(request.submissionId) ?? 0) + 1);
    return map;
  }, [pendingAnswerRequests, pendingDeleteRequests]);
  const filtered = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase("de-AT");
    return activities.filter((activity) => {
      if (
        filter === "requests" &&
        !pendingBySubmission.has(activity.submissionId)
      )
        return false;
      return (
        !needle ||
        `${activity.market.name} ${activity.market.address} ${activity.questionnaireName}`
          .toLocaleLowerCase("de-AT")
          .includes(needle)
      );
    });
  }, [activities, filter, pendingBySubmission, search]);
  const selectedDeleteRequest = selected
    ? (deleteRequests.find(
        (request) => request.submissionId === selected.submissionId,
      ) ?? null)
    : null;
  const selectedAnswerRequest =
    selected && selectedQuestion
      ? requestForQuestion(
          answerRequests,
          selected.submissionId,
          selectedQuestion.id,
        )
      : null;

  return (
    <main className="sm-act-page">
      <style>{`
    .sm-act-page{min-height:100dvh;overflow-x:hidden;padding-bottom:108px;background:#f5f5f7;color:#111827;font-family:var(--font-inter),Inter,system-ui,sans-serif}.sm-act-page *{box-sizing:border-box}.sm-act-shell{width:100%;max-width:440px;margin:0 auto;padding:24px 16px 30px}.sm-act-header>span{color:rgba(220,38,38,.62);font-size:8px;font-weight:800;letter-spacing:.1em;text-transform:uppercase}.sm-act-header h1{margin:5px 0 0;font-size:26px;line-height:1.05;font-weight:790;letter-spacing:-.025em}.sm-act-header p{margin:7px 0 0;color:rgba(15,23,42,.43);font-size:11px;font-weight:580;line-height:1.45}.sm-act-stats{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:17px}.sm-act-stat{min-height:79px;padding:12px;border:1px solid rgba(15,23,42,.06);border-radius:15px;background:#fff;box-shadow:0 2px 8px rgba(15,23,42,.035),0 14px 32px rgba(15,23,42,.035)}.sm-act-stat div{display:flex;align-items:center;justify-content:space-between;color:rgba(15,23,42,.34);font-size:7px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}.sm-act-stat i{width:24px;height:24px;display:grid;place-items:center;border-radius:8px;background:rgba(220,38,38,.055);color:${RED};font-style:normal}.sm-act-stat strong{display:block;margin-top:9px;font-size:20px;line-height:1;font-weight:800}.sm-act-stat small{display:block;margin-top:5px;color:rgba(15,23,42,.36);font-size:8px;font-weight:620}.sm-act-toolbar{margin-top:12px;padding:8px;border:1px solid rgba(15,23,42,.06);border-radius:14px;background:#fff;box-shadow:0 2px 8px rgba(15,23,42,.03)}.sm-act-search{height:34px;display:flex;align-items:center;gap:7px;padding:0 10px;border-radius:9px;background:rgba(15,23,42,.035);color:rgba(15,23,42,.3)}.sm-act-search input{min-width:0;flex:1;border:0;outline:0;background:transparent;color:rgba(15,23,42,.76);font:inherit;font-size:9px;font-weight:650}.sm-act-filters{display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-top:7px;padding:3px;border-radius:9px;background:rgba(15,23,42,.03)}.sm-act-filters button{height:27px;border:0;border-radius:7px;background:transparent;color:rgba(15,23,42,.38);font:inherit;font-size:8px;font-weight:750}.sm-act-filters button.active{background:#fff;color:rgba(15,23,42,.8);box-shadow:0 1px 5px rgba(15,23,42,.06),inset 0 0 0 1px rgba(15,23,42,.055)}.sm-act-list{display:grid;gap:10px;margin-top:12px}.sm-act-card{width:100%;padding:13px;border:1px solid rgba(15,23,42,.06);border-radius:16px;background:#fff;box-shadow:0 2px 8px rgba(15,23,42,.035),0 15px 34px rgba(15,23,42,.038);text-align:left;font:inherit}.sm-act-card-top{display:flex;align-items:center;justify-content:space-between;gap:8px}.sm-act-card-pill{height:20px;display:inline-flex;align-items:center;padding:0 7px;border-radius:999px;background:rgba(5,150,105,.07);color:${GREEN};font-size:7px;font-weight:800;text-transform:uppercase}.sm-act-card-date{color:rgba(15,23,42,.34);font-size:8px;font-weight:700}.sm-act-card h2{margin:10px 0 0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:15px;font-weight:790}.sm-act-card-address{display:flex;align-items:center;gap:5px;margin-top:5px;color:rgba(15,23,42,.4);font-size:8px;font-weight:600}.sm-act-card-grid{display:grid;grid-template-columns:repeat(3,1fr);margin-top:12px;padding:9px 0;border-top:1px solid rgba(15,23,42,.05);border-bottom:1px solid rgba(15,23,42,.05)}.sm-act-card-grid div{padding:0 8px;border-left:1px solid rgba(15,23,42,.05)}.sm-act-card-grid div:first-child{padding-left:0;border-left:0}.sm-act-card-grid span,.sm-act-card-grid strong{display:block}.sm-act-card-grid span{color:rgba(15,23,42,.3);font-size:6.5px;font-weight:750;text-transform:uppercase}.sm-act-card-grid strong{margin-top:3px;font-size:9px;font-weight:780}.sm-act-card-footer{display:flex;align-items:center;justify-content:space-between;margin-top:10px;color:${GREEN};font-size:8px;font-weight:750}.sm-act-card-footer .request{color:${AMBER}}.sm-act-empty,.sm-act-loading{min-height:200px;display:grid;place-items:center;align-content:center;gap:8px;margin-top:12px;border:1px dashed rgba(15,23,42,.09);border-radius:16px;background:rgba(255,255,255,.62);color:rgba(15,23,42,.38);text-align:center}.sm-act-empty strong,.sm-act-loading strong{color:rgba(15,23,42,.62);font-size:11px}.sm-act-empty span{max-width:250px;font-size:8px;line-height:1.5}.sm-act-empty button,.sm-act-view-state button{height:28px;display:flex;align-items:center;gap:5px;padding:0 10px;border:1px solid rgba(15,23,42,.08);border-radius:8px;background:#fff;color:#475569;font:inherit;font-size:8px;font-weight:750}.sm-act-viewer-backdrop,.sm-act-modal-backdrop{position:fixed;inset:0;z-index:12000;display:grid;place-items:center;padding:12px;background:rgba(15,23,42,.32);backdrop-filter:blur(5px)}.sm-act-viewer{width:min(430px,100%);max-height:calc(100dvh - 24px);display:flex;flex-direction:column;overflow:hidden;border:1px solid rgba(255,255,255,.7);border-radius:19px;background:#f5f5f7;box-shadow:0 25px 70px rgba(15,23,42,.25)}.sm-act-viewer-head{min-height:60px;display:grid;grid-template-columns:30px minmax(0,1fr) 30px;align-items:center;gap:8px;padding:9px 12px;border-bottom:1px solid rgba(15,23,42,.06);background:#fff}.sm-act-viewer-head button,.sm-act-sheet header button{width:28px;height:28px;display:grid;place-items:center;border:0;border-radius:8px;background:rgba(15,23,42,.035);color:rgba(15,23,42,.45)}.sm-act-viewer-head div{min-width:0}.sm-act-viewer-head span,.sm-act-sheet header span{display:block;color:rgba(220,38,38,.58);font-size:6.5px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}.sm-act-viewer-head h2{margin:3px 0 0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;font-weight:790}.sm-act-viewer-meta{display:grid;gap:5px;padding:10px 14px;border-bottom:1px solid rgba(15,23,42,.05);background:#fff}.sm-act-viewer-meta div{display:flex;align-items:center;gap:6px;color:rgba(15,23,42,.42);font-size:8px;font-weight:620}.sm-act-delete-bar{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:10px 10px 0;padding:9px 10px;border:1px solid rgba(220,38,38,.08);border-radius:11px;background:rgba(220,38,38,.035)}.sm-act-delete-bar div{display:flex;align-items:center;gap:6px;color:rgba(120,20,20,.62);font-size:8px;font-weight:700}.sm-act-delete-bar button{height:24px;padding:0 8px;border:1px solid rgba(220,38,38,.12);border-radius:7px;background:#fff;color:${RED};font:inherit;font-size:7px;font-weight:800}.sm-act-delete-bar button.pending{color:${AMBER}}.sm-act-viewer-strip{display:grid;grid-template-columns:1.4fr 1fr .65fr;margin:9px 10px 0;padding:9px 0;border:1px solid rgba(15,23,42,.055);border-radius:11px;background:#fff}.sm-act-viewer-strip div{padding:0 9px;border-left:1px solid rgba(15,23,42,.05)}.sm-act-viewer-strip div:first-child{border-left:0}.sm-act-viewer-strip span,.sm-act-viewer-strip strong{display:block}.sm-act-viewer-strip span{color:rgba(15,23,42,.3);font-size:6px;font-weight:750;text-transform:uppercase}.sm-act-viewer-strip strong{margin-top:3px;font-size:8px;font-weight:760}.sm-act-view-state{min-height:280px;display:grid;place-items:center;align-content:center;gap:8px;color:rgba(15,23,42,.38);text-align:center}.sm-act-view-state strong{font-size:10px;color:rgba(15,23,42,.65)}.sm-act-view-state span{max-width:260px;font-size:8px;line-height:1.5}.sm-act-view-state.is-error svg{color:${RED}}.sm-act-question-list{min-height:0;overflow:auto;display:grid;gap:10px;padding:10px;scrollbar-width:none}.sm-act-question-list::-webkit-scrollbar{display:none}.sm-act-module{display:grid;gap:7px}.sm-act-module>header{display:flex;align-items:center;justify-content:space-between;padding:4px 2px}.sm-act-module>header span{font-size:8px;font-weight:800;text-transform:uppercase;color:rgba(15,23,42,.52)}.sm-act-module>header small{font-size:7px;color:rgba(15,23,42,.3)}.sm-act-question-card{padding:12px;border:1px solid rgba(15,23,42,.06);border-radius:14px;background:#fff;box-shadow:0 2px 8px rgba(15,23,42,.025)}.sm-act-question-meta{display:flex;align-items:center;gap:7px}.sm-act-question-meta span{width:20px;height:20px;display:grid;place-items:center;border-radius:7px;background:rgba(220,38,38,.07);color:${RED};font-size:7px;font-weight:800}.sm-act-question-meta small{color:rgba(15,23,42,.34);font-size:6.5px;font-weight:800;text-transform:uppercase}.sm-act-question-card h3{margin:10px 0 0;font-size:10px;line-height:1.42;font-weight:730}.sm-act-answer-chips{display:flex;flex-wrap:wrap;gap:5px;margin-top:10px}.sm-act-answer-chips span{min-height:24px;display:inline-flex;align-items:center;gap:4px;padding:0 8px;border-radius:8px;background:rgba(5,150,105,.07);color:${GREEN};font-size:7.5px;font-weight:700}.sm-act-answer-text,.sm-act-answer-empty{margin-top:10px;padding:9px 10px;border-radius:9px;background:rgba(15,23,42,.03);color:rgba(15,23,42,.68);font-size:9px;font-weight:650;line-height:1.45}.sm-act-answer-empty{color:rgba(15,23,42,.35);font-weight:600}.sm-act-photo-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:10px}.sm-act-photo-grid>div,.sm-act-photo-grid>button{position:relative;aspect-ratio:1;display:grid;place-items:center;overflow:hidden;border:1px solid rgba(15,23,42,.07);border-radius:9px;background:#f8fafc}.sm-act-photo-grid img{width:100%;height:100%;object-fit:cover}.sm-act-photo-grid.is-edit button{padding:0}.sm-act-photo-grid.is-edit button.selected{border:2px solid ${GREEN}}.sm-act-photo-grid.is-edit button span{position:absolute;right:5px;top:5px;width:18px;height:18px;display:grid;place-items:center;border-radius:999px;background:${GREEN};color:#fff}.sm-act-question-action{display:flex;justify-content:flex-end;margin-top:10px;padding-top:9px;border-top:1px solid rgba(15,23,42,.05)}.sm-act-question-action button{height:25px;display:inline-flex;align-items:center;gap:5px;padding:0 8px;border:1px solid rgba(5,150,105,.13);border-radius:7px;background:#fff;color:${GREEN};font:inherit;font-size:7px;font-weight:780}.sm-act-question-action button.pending{border-color:rgba(217,119,6,.12);color:${AMBER}}.sm-act-request-status{margin-top:9px;padding:7px 8px;border-radius:8px;background:rgba(15,23,42,.035);font-size:7px;font-weight:750;color:#64748b}.sm-act-request-status.is-pending{background:rgba(245,158,11,.07);color:#b45309}.sm-act-request-status.is-approved{background:rgba(5,150,105,.07);color:${GREEN}}.sm-act-request-status.is-rejected{background:rgba(220,38,38,.06);color:${RED}}.sm-act-request-status p{margin:4px 0 0;font-weight:600;line-height:1.4}.sm-act-viewer-footer{min-height:46px;display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-top:1px solid rgba(15,23,42,.06);background:#fff}.sm-act-viewer-footer button{height:28px;padding:0 10px;border:1px solid rgba(15,23,42,.07);border-radius:8px;background:#fff;color:rgba(15,23,42,.5);font:inherit;font-size:8px;font-weight:750}.sm-act-viewer-footer span{display:flex;align-items:center;gap:4px;color:${GREEN};font-size:7px;font-weight:750}.sm-act-sheet{width:min(400px,100%);max-height:calc(100dvh - 24px);display:flex;flex-direction:column;overflow:hidden;border:1px solid rgba(15,23,42,.06);border-radius:17px;background:#fff;box-shadow:0 24px 70px rgba(15,23,42,.25)}.sm-act-sheet header{min-height:58px;display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border-bottom:1px solid rgba(15,23,42,.055)}.sm-act-sheet header h3{margin:3px 0 0;font-size:13px;font-weight:780}.sm-act-sheet-body{min-height:0;overflow:auto;padding-bottom:12px;scrollbar-width:none}.sm-act-sheet-body::-webkit-scrollbar{display:none}.sm-act-context{display:grid;grid-template-columns:25px minmax(0,1fr);align-items:center;gap:7px;margin:12px 13px 0;padding:9px;border-radius:10px;background:rgba(15,23,42,.025);color:${RED}}.sm-act-context strong,.sm-act-context span{display:block}.sm-act-context strong{color:rgba(15,23,42,.76);font-size:9px}.sm-act-context span{margin-top:2px;color:rgba(15,23,42,.36);font-size:7px}.sm-act-question-copy{margin:11px 13px 0}.sm-act-question-copy small,.sm-act-field>span,.sm-act-request-existing small{display:block;margin-bottom:5px;color:rgba(15,23,42,.34);font-size:6.5px;font-weight:800;text-transform:uppercase}.sm-act-question-copy strong{display:block;font-size:9px;line-height:1.45}.sm-act-question-copy p{margin:5px 0 0;color:rgba(15,23,42,.4);font-size:8px}.sm-act-field{display:block;margin:12px 13px 0}.sm-act-field textarea,.sm-act-edit-textarea,.sm-act-edit-input{width:100%;padding:9px;border:1px solid rgba(15,23,42,.09);border-radius:9px;outline:0;resize:none;background:#fff;color:rgba(15,23,42,.78);font:inherit;font-size:9px;font-weight:620;line-height:1.45}.sm-act-field>textarea{min-height:72px}.sm-act-edit-textarea{min-height:92px}.sm-act-edit-options{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}.sm-act-edit-options button{min-height:34px;display:flex;align-items:center;justify-content:center;gap:4px;padding:6px;border:1px solid rgba(15,23,42,.08);border-radius:9px;background:#fff;color:rgba(15,23,42,.5);font:inherit;font-size:8px;font-weight:700}.sm-act-edit-options button.selected{border-color:rgba(5,150,105,.16);background:rgba(5,150,105,.06);color:${GREEN}}.sm-act-edit-options.is-sub{margin-top:7px;grid-template-columns:1fr}.sm-act-slider{padding:10px;border-radius:10px;background:rgba(15,23,42,.025)}.sm-act-slider strong{display:block;text-align:center;font-size:17px;color:${RED}}.sm-act-slider input{width:100%;accent-color:${RED}}.sm-act-slider div{display:flex;justify-content:space-between;color:rgba(15,23,42,.35);font-size:7px}.sm-act-matrix{display:grid;gap:4px;overflow:auto}.sm-act-matrix>div{display:grid;grid-template-columns:minmax(75px,1.4fr) repeat(var(--matrix-columns),minmax(36px,1fr));gap:4px;align-items:center}.sm-act-matrix span,.sm-act-matrix strong{font-size:7px;text-align:center}.sm-act-matrix strong{text-align:left;color:rgba(15,23,42,.55)}.sm-act-matrix button{height:29px;border:1px solid rgba(15,23,42,.08);border-radius:7px;background:#fff;color:${RED}}.sm-act-matrix button.selected{background:rgba(220,38,38,.06);border-color:rgba(220,38,38,.16)}.sm-act-photo-help{margin:0 0 7px;color:rgba(15,23,42,.42);font-size:7.5px;line-height:1.45}.sm-act-request-existing{margin:10px 13px;padding:10px;border-radius:10px;background:rgba(245,158,11,.045);border:1px solid rgba(217,119,6,.1)}.sm-act-request-existing strong,.sm-act-request-existing p{margin:3px 0 0;font-size:8.5px;line-height:1.45}.sm-act-sheet-body>.sm-act-request-status{margin:10px 13px}.sm-act-delete-warning{display:flex;gap:8px;margin:12px 13px 0;padding:10px;border:1px solid rgba(220,38,38,.1);border-radius:10px;background:rgba(220,38,38,.035);color:${RED}}.sm-act-delete-warning strong{display:block;color:rgba(120,20,20,.72);font-size:9px}.sm-act-delete-warning p{margin:4px 0 0;color:rgba(15,23,42,.46);font-size:7.5px;line-height:1.45}.sm-act-error{display:flex;align-items:center;gap:6px;margin:10px 13px 0;padding:8px;border-radius:8px;background:rgba(220,38,38,.055);color:${RED};font-size:7.5px;font-weight:650}.sm-act-sheet footer{display:flex;justify-content:flex-end;gap:7px;padding:10px 13px;border-top:1px solid rgba(15,23,42,.055);background:#fff}.sm-act-sheet footer button{height:30px;display:inline-flex;align-items:center;justify-content:center;gap:5px;padding:0 11px;border-radius:8px;font:inherit;font-size:8px;font-weight:780}.sm-act-sheet footer .secondary{border:1px solid rgba(15,23,42,.07);background:#fff;color:rgba(15,23,42,.48)}.sm-act-sheet footer .primary{border:1px solid rgba(255,255,255,.3);background:linear-gradient(180deg,#10b981,#059669);color:#fff}.sm-act-sheet footer .primary.danger{background:linear-gradient(180deg,#f43f46,#d71920)}.sm-act-sheet footer .primary:disabled{opacity:.38}@media(max-width:520px){.sm-act-viewer-backdrop{align-items:stretch;padding:0 0 78px;background:#f5f5f7;backdrop-filter:none}.sm-act-viewer{width:100%;max-height:none;border:0;border-radius:0;box-shadow:none}.sm-act-modal-backdrop{align-items:end;padding:0}.sm-act-sheet{width:100%;max-height:calc(100dvh - 30px);border-radius:17px 17px 0 0;padding-bottom:env(safe-area-inset-bottom)}}
  `}</style>
      <style>{`
        .sm-act-stat-button {
          width: 100%;
          margin: 0;
          border: 1px solid rgba(15,23,42,.06);
          color: inherit;
          font: inherit;
          text-align: left;
          cursor: pointer;
          transition: transform .16s ease, border-color .16s ease, box-shadow .16s ease;
        }
        .sm-act-stat-button:active { transform: scale(.985); }
        .sm-act-stat-button:focus-visible,
        .sm-act-history button:focus-visible,
        .sm-act-clear-answer:focus-visible {
          outline: 2px solid rgba(220,38,38,.32);
          outline-offset: 2px;
        }
        .sm-act-clear-answer {
          width: 100%;
          min-height: 29px;
          margin-top: 7px;
          border: 1px solid rgba(220,38,38,.1);
          border-radius: 8px;
          background: rgba(220,38,38,.035);
          color: ${RED};
          font: inherit;
          font-size: 7.5px;
          font-weight: 750;
        }
        .sm-act-history {
          width: min(410px,100%);
          max-height: calc(100dvh - 24px);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          border: 1px solid rgba(255,255,255,.72);
          border-radius: 18px;
          background: #f6f7f9;
          box-shadow: 0 25px 70px rgba(15,23,42,.25);
        }
        .sm-act-history > header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 15px;
          border-bottom: 1px solid rgba(15,23,42,.06);
          background: #fff;
        }
        .sm-act-history > header > div:first-child { min-width: 0; }
        .sm-act-history > header span {
          display: block;
          color: rgba(220,38,38,.62);
          font-size: 6.5px;
          font-weight: 800;
          letter-spacing: .09em;
          text-transform: uppercase;
        }
        .sm-act-history > header h2 {
          margin: 4px 0 0;
          font-size: 16px;
          line-height: 1.05;
          font-weight: 800;
        }
        .sm-act-history > header p {
          margin: 5px 0 0;
          color: rgba(15,23,42,.38);
          font-size: 8px;
          line-height: 1.4;
        }
        .sm-act-history > header > div:last-child { display: flex; gap: 6px; }
        .sm-act-history > header button {
          width: 29px;
          height: 29px;
          display: grid;
          place-items: center;
          border: 1px solid rgba(15,23,42,.07);
          border-radius: 9px;
          background: #fff;
          color: #64748b;
        }
        .sm-act-history-list {
          min-height: 180px;
          overflow: auto;
          display: grid;
          align-content: start;
          gap: 8px;
          padding: 10px;
          scrollbar-width: none;
        }
        .sm-act-history-list::-webkit-scrollbar { display: none; }
        .sm-act-history-card {
          padding: 11px;
          border: 1px solid rgba(15,23,42,.06);
          border-radius: 13px;
          background: #fff;
          box-shadow: 0 3px 14px rgba(15,23,42,.035);
        }
        .sm-act-history-card-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }
        .sm-act-history-card-top span {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          color: #64748b;
          font-size: 6.5px;
          font-weight: 800;
          letter-spacing: .05em;
          text-transform: uppercase;
        }
        .sm-act-history-card-top strong {
          padding: 3px 6px;
          border-radius: 999px;
          background: rgba(15,23,42,.045);
          color: #64748b;
          font-size: 6.5px;
          font-weight: 800;
        }
        .sm-act-history-card.is-pending .sm-act-history-card-top strong {
          background: rgba(245,158,11,.08);
          color: #b45309;
        }
        .sm-act-history-card.is-approved .sm-act-history-card-top strong {
          background: rgba(5,150,105,.08);
          color: ${GREEN};
        }
        .sm-act-history-card.is-rejected .sm-act-history-card-top strong {
          background: rgba(220,38,38,.07);
          color: ${RED};
        }
        .sm-act-history-card h3 {
          margin: 9px 0 0;
          font-size: 9.5px;
          line-height: 1.42;
          font-weight: 760;
        }
        .sm-act-history-context {
          margin: 4px 0 0;
          color: rgba(15,23,42,.36);
          font-size: 7px;
          font-weight: 620;
        }
        .sm-act-history-diff {
          display: grid;
          grid-template-columns: minmax(0,1fr) 16px minmax(0,1fr);
          align-items: center;
          gap: 4px;
          margin-top: 9px;
          padding: 8px;
          border-radius: 9px;
          background: rgba(15,23,42,.025);
        }
        .sm-act-history-diff span,
        .sm-act-history-diff strong {
          overflow: hidden;
          color: rgba(15,23,42,.5);
          font-size: 7.5px;
          line-height: 1.35;
          text-overflow: ellipsis;
        }
        .sm-act-history-diff strong { color: ${GREEN}; }
        .sm-act-history-diff svg { color: rgba(15,23,42,.22); }
        .sm-act-history-delete-copy,
        .sm-act-history-reason,
        .sm-act-history-note {
          margin: 8px 0 0;
          padding: 7px 8px;
          border-radius: 8px;
          background: rgba(15,23,42,.025);
          color: #64748b;
          font-size: 7.5px;
          line-height: 1.45;
        }
        .sm-act-history-delete-copy {
          background: rgba(220,38,38,.035);
          color: #991b1b;
        }
        .sm-act-history-note {
          background: rgba(5,150,105,.045);
          color: ${GREEN};
        }
        .sm-act-history-error {
          display: flex;
          align-items: center;
          gap: 6px;
          margin: 9px 10px 0;
          padding: 8px;
          border-radius: 8px;
          background: rgba(220,38,38,.055);
          color: ${RED};
          font-size: 7.5px;
        }
        .sm-act-history-empty {
          min-height: 220px;
          display: grid;
          place-items: center;
          align-content: center;
          gap: 7px;
          color: rgba(15,23,42,.28);
          text-align: center;
        }
        .sm-act-history-empty strong { color: rgba(15,23,42,.62); font-size: 10px; }
        .sm-act-history-empty span { font-size: 7.5px; }
        @media (max-width: 520px) {
          .sm-act-history {
            width: 100%;
            max-height: calc(100dvh - 30px);
            align-self: end;
            border-radius: 17px 17px 0 0;
            padding-bottom: env(safe-area-inset-bottom);
          }
        }
      `}</style>
      <div className="sm-act-shell">
        <header className="sm-act-header">
          <span>Aktivitäten</span>
          <h1>Meine Fragebögen</h1>
          <p>Deine abgeschlossenen Einsätze als sichere Read-only Ansicht.</p>
        </header>
        <section className="sm-act-stats">
          <article className="sm-act-stat">
            <div>
              Abgeschlossen
              <i>
                <ClipboardCheck size={12} />
              </i>
            </div>
            <strong>{activities.length}</strong>
            <small>Fragebögen verfügbar</small>
          </article>
          <button
            type="button"
            className="sm-act-stat sm-act-stat-button"
            onClick={() => setHistoryOpen(true)}
          >
            <div>
              Anfragen
              <i
                style={{
                  color: requestCount ? AMBER : GREEN,
                  background: requestCount
                    ? "rgba(245,158,11,.07)"
                    : "rgba(5,150,105,.06)",
                }}
              >
                <Inbox size={12} />
              </i>
            </div>
            <strong style={{ color: requestCount ? AMBER : GREEN }}>
              {requestCount}
            </strong>
            <small>{requestCount ? "werden geprüft" : "keine offenen"}</small>
          </button>
        </section>
        <section className="sm-act-toolbar">
          <label className="sm-act-search">
            <Search size={11} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Markt oder Fragebogen suchen …"
            />
          </label>
          <div className="sm-act-filters">
            <button
              type="button"
              className={filter === "all" ? "active" : ""}
              onClick={() => setFilter("all")}
            >
              Alle
            </button>
            <button
              type="button"
              className={filter === "requests" ? "active" : ""}
              onClick={() => setFilter("requests")}
            >
              Mit Anfrage {requestCount ? `(${requestCount})` : ""}
            </button>
          </div>
        </section>
        {loading ? (
          <div className="sm-act-loading">
            <Loader2 size={19} className="animate-spin" />
            <strong>Aktivitäten werden geladen</strong>
          </div>
        ) : error ? (
          <div className="sm-act-empty">
            <AlertCircle size={20} />
            <strong>Aktivitäten konnten nicht geladen werden</strong>
            <span>{error}</span>
            <button type="button" onClick={() => void loadAll()}>
              <RefreshCw size={11} />
              Erneut versuchen
            </button>
          </div>
        ) : filtered.length ? (
          <section className="sm-act-list">
            {filtered.map((activity) => {
              const count = pendingBySubmission.get(activity.submissionId) ?? 0;
              return (
                <button
                  key={activity.submissionId}
                  type="button"
                  className="sm-act-card"
                  onClick={() => openActivity(activity)}
                >
                  <div className="sm-act-card-top">
                    <span className="sm-act-card-pill">Abgeschlossen</span>
                    <span className="sm-act-card-date">
                      {formatDate(activity.submittedAt, true)}
                    </span>
                  </div>
                  <h2>{activity.market.name}</h2>
                  <div className="sm-act-card-address">
                    <MapPin size={10} />
                    <span>
                      {[
                        activity.market.address,
                        activity.market.postalCode,
                        activity.market.city,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </div>
                  <div className="sm-act-card-grid">
                    <div>
                      <span>Ist / Soll</span>
                      <strong>
                        {duration(activity.actualMinutes)} /{" "}
                        {duration(activity.plannedMinutes)}
                      </strong>
                    </div>
                    <div>
                      <span>Fragen</span>
                      <strong>
                        {activity.totals.answeredCount}/
                        {activity.totals.questionCount}
                      </strong>
                    </div>
                    <div>
                      <span>Status</span>
                      <strong style={{ color: count ? AMBER : GREEN }}>
                        {count ? "Prüfung" : "Fertig"}
                      </strong>
                    </div>
                  </div>
                  <div className="sm-act-card-footer">
                    <span className={count ? "request" : ""}>
                      {count ? (
                        `${count} Anfrage${count === 1 ? "" : "n"} offen`
                      ) : (
                        <>
                          <CheckCircle2 size={10} />
                          Read-only ansehen
                        </>
                      )}
                    </span>
                    <ChevronRight size={13} />
                  </div>
                </button>
              );
            })}
          </section>
        ) : (
          <div className="sm-act-empty">
            <Inbox size={20} />
            <strong>Keine Fragebögen gefunden</strong>
            <span>
              Für diese Suche oder Auswahl gibt es keine abgeschlossenen
              Einsätze.
            </span>
          </div>
        )}
      </div>
      {selected ? (
        <ActivityViewer
          summary={selected}
          payload={payload}
          loading={payloadLoading}
          error={payloadError}
          answerRequests={answerRequests.filter(
            (request) => request.submissionId === selected.submissionId,
          )}
          deleteRequest={selectedDeleteRequest}
          onClose={() => {
            setSelected(null);
            setPayload(null);
            setSelectedQuestion(null);
          }}
          onRetry={() => void loadPayload(selected)}
          onQuestion={setSelectedQuestion}
          onDelete={() => setDeleteOpen(true)}
        />
      ) : null}
      {selected && payload && selectedQuestion ? (
        <ChangeRequestSheet
          summary={selected}
          question={selectedQuestion}
          currentAnswer={payload.answers[selectedQuestion.id] ?? null}
          photos={payload.photoFiles[selectedQuestion.id] ?? []}
          existing={selectedAnswerRequest}
          onClose={() => setSelectedQuestion(null)}
          onSaved={loadRequests}
        />
      ) : null}
      {selected && deleteOpen ? (
        <DeleteRequestSheet
          summary={selected}
          existing={selectedDeleteRequest}
          onClose={() => setDeleteOpen(false)}
          onSaved={loadRequests}
        />
      ) : null}
      {historyOpen ? (
        <RequestHistoryModal
          answerRequests={answerRequests}
          deleteRequests={deleteRequests}
          onClose={() => setHistoryOpen(false)}
          onRefresh={refreshRequestsAndPayload}
        />
      ) : null}
      <div className="fixed bottom-6 left-0 right-0 z-50">
        <CollapsibleMenu
          items={MENU_ITEMS}
          enableKurti
          featureKurti={false}
          kurtiMaxWidth={420}
          enableClickToggle
          defaultIndex={1}
          onSelect={(_index, item) => {
            if (item.action === "logout") {
              logoutCurrentUser();
              window.location.assign("/");
              return;
            }
            if (item.href) router.push(item.href);
          }}
        />
      </div>
    </main>
  );
}
