"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  CheckCheck,
  ChevronRight,
  Clock3,
  Inbox,
  Loader2,
  Maximize2,
  Minimize2,
  RefreshCcw,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import {
  approveAdminAnswerChangeRequest,
  approveAdminTimeEntryChangeRequest,
  approveAdminVisitSessionDeleteRequest,
  fetchAdminAnswerChangeRequests,
  fetchAdminTimeEntryChangeRequests,
  fetchAdminVisitSessionDeleteRequests,
  rejectAdminAnswerChangeRequest,
  rejectAdminTimeEntryChangeRequest,
  rejectAdminVisitSessionDeleteRequest,
  type AdminAnswerChangeRequest,
  type AdminVisitSessionDeleteRequest,
  type TimeEntryChangeRequest,
} from "@/lib/api/backend";

type RequestAction = "approve" | "reject";

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("de-AT", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatTime(value: string | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("de-AT", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatTimeRange(start: string, end: string): string {
  return `${formatTime(start)} - ${formatTime(end)}`;
}

function initials(name: string): string {
  const parts = name
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) return "GM";
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function sectionLabel(section: AdminAnswerChangeRequest["section"]["section"]): string {
  if (section === "standard") return "Standard";
  if (section === "flex") return "Flex";
  if (section === "billa") return "Billa";
  if (section === "kuehler") return "Kühler";
  if (section === "mhd") return "MHD";
  return section;
}

function marketLabel(request: AdminAnswerChangeRequest): string {
  const fallback = [request.market.address, request.market.postalCode, request.market.city].filter(Boolean).join(", ");
  return request.market.name?.trim() || fallback || "Markt";
}

function deleteRequestMarketLabel(request: AdminVisitSessionDeleteRequest): string {
  const fallback = [request.market.address, request.market.postalCode, request.market.city].filter(Boolean).join(", ");
  return request.market.name?.trim() || fallback || "Markt";
}

function currentAnswerLabel(snapshot: Record<string, unknown>): string {
  const options = Array.isArray(snapshot.options)
    ? snapshot.options
        .map((entry) => {
          if (entry && typeof entry === "object" && "optionValue" in entry) {
            return String((entry as { optionValue?: unknown }).optionValue ?? "").trim();
          }
          return String(entry ?? "").trim();
        })
        .filter(Boolean)
    : [];
  if (options.length > 0) return options.join(", ");

  const text = typeof snapshot.valueText === "string" ? snapshot.valueText.trim() : "";
  if (text) return text;

  if (snapshot.valueNumber !== null && snapshot.valueNumber !== undefined) return String(snapshot.valueNumber);

  const json = snapshot.valueJson;
  if (json && typeof json === "object") {
    const record = json as Record<string, unknown>;
    if (typeof record.sel === "string" && record.sel.trim()) {
      const subs = Array.isArray(record.subs) ? record.subs.map(String).filter(Boolean) : [];
      return [record.sel, ...subs].join(", ");
    }
    return "Strukturierte Antwort";
  }

  const photos = Array.isArray(snapshot.photos) ? snapshot.photos : [];
  if (photos.length > 0) return `${photos.length} Foto${photos.length === 1 ? "" : "s"}`;

  const matrixCells = Array.isArray(snapshot.matrixCells) ? snapshot.matrixCells : [];
  if (matrixCells.length > 0) return `${matrixCells.length} Matrixwerte`;

  return "Keine Antwort";
}

function sortRequests(input: AdminAnswerChangeRequest[]): AdminAnswerChangeRequest[] {
  return [...input].sort((a, b) => {
    if (a.status === "pending" && b.status !== "pending") return -1;
    if (a.status !== "pending" && b.status === "pending") return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

function sortTimeRequests(input: TimeEntryChangeRequest[]): TimeEntryChangeRequest[] {
  return [...input].sort((a, b) => {
    if (a.status === "pending" && b.status !== "pending") return -1;
    if (a.status !== "pending" && b.status === "pending") return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

function sortDeleteRequests(input: AdminVisitSessionDeleteRequest[]): AdminVisitSessionDeleteRequest[] {
  return [...input].sort((a, b) => {
    if (a.status === "pending" && b.status !== "pending") return -1;
    if (a.status !== "pending" && b.status === "pending") return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

function timeKindLabel(kind: TimeEntryChangeRequest["sourceKind"]): string {
  if (kind === "marktbesuch") return "Marktbesuch";
  if (kind === "pause") return "Pause";
  return "Zusatz";
}

export function AnswerChangeRequestFlap() {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [requests, setRequests] = useState<AdminAnswerChangeRequest[]>([]);
  const [timeRequests, setTimeRequests] = useState<TimeEntryChangeRequest[]>([]);
  const [deleteRequests, setDeleteRequests] = useState<AdminVisitSessionDeleteRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [selectedGmId, setSelectedGmId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextAnswerRequests, nextTimeRequests, nextDeleteRequests] = await Promise.all([
        fetchAdminAnswerChangeRequests(),
        fetchAdminTimeEntryChangeRequests(),
        fetchAdminVisitSessionDeleteRequests(),
      ]);
      setRequests(sortRequests(nextAnswerRequests));
      setTimeRequests(sortTimeRequests(nextTimeRequests));
      setDeleteRequests(sortDeleteRequests(nextDeleteRequests));
    } catch (err) {
      setError(err instanceof Error ? err.message : "?nderungsanfragen konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  const pendingRequests = useMemo(() => requests.filter((request) => request.status === "pending"), [requests]);
  const pendingTimeRequests = useMemo(() => timeRequests.filter((request) => request.status === "pending"), [timeRequests]);
  const pendingDeleteRequests = useMemo(() => deleteRequests.filter((request) => request.status === "pending"), [deleteRequests]);
  const recentRequests = useMemo(() => requests.slice(0, 12), [requests]);
  const recentTimeRequests = useMemo(() => timeRequests.slice(0, 8), [timeRequests]);
  const recentDeleteRequests = useMemo(() => deleteRequests.slice(0, 8), [deleteRequests]);
  const totalPendingCount = pendingRequests.length + pendingTimeRequests.length + pendingDeleteRequests.length;

  const people = useMemo(() => {
    const byGm = new Map<string, {
      id: string;
      name: string;
      email: string;
      region: string | null;
      requests: AdminAnswerChangeRequest[];
      timeRequests: TimeEntryChangeRequest[];
      deleteRequests: AdminVisitSessionDeleteRequest[];
    }>();
    for (const request of pendingRequests) {
      const entry = byGm.get(request.gm.id) ?? {
        id: request.gm.id,
        name: request.gm.name,
        email: request.gm.email,
        region: request.gm.region,
        requests: [],
        timeRequests: [],
        deleteRequests: [],
      };
      entry.requests.push(request);
      byGm.set(request.gm.id, entry);
    }
    for (const request of pendingTimeRequests) {
      const gm = request.gm;
      if (!gm) continue;
      const entry = byGm.get(gm.id) ?? {
        id: gm.id,
        name: gm.name,
        email: gm.email,
        region: gm.region,
        requests: [],
        timeRequests: [],
        deleteRequests: [],
      };
      entry.timeRequests.push(request);
      byGm.set(gm.id, entry);
    }
    for (const request of pendingDeleteRequests) {
      const entry = byGm.get(request.gm.id) ?? {
        id: request.gm.id,
        name: request.gm.name,
        email: request.gm.email,
        region: request.gm.region,
        requests: [],
        timeRequests: [],
        deleteRequests: [],
      };
      entry.deleteRequests.push(request);
      byGm.set(request.gm.id, entry);
    }
    return Array.from(byGm.values()).sort((a, b) => {
      const countDiff = (b.requests.length + b.timeRequests.length + b.deleteRequests.length) - (a.requests.length + a.timeRequests.length + a.deleteRequests.length);
      if (countDiff !== 0) return countDiff;
      return a.name.localeCompare(b.name);
    });
  }, [pendingRequests, pendingTimeRequests, pendingDeleteRequests]);

  useEffect(() => {
    if (!expanded) return;
    if (selectedGmId && people.some((person) => person.id === selectedGmId)) return;
    setSelectedGmId(people[0]?.id ?? null);
  }, [expanded, people, selectedGmId]);

  const selectedPerson = useMemo(
    () => people.find((person) => person.id === selectedGmId) ?? people[0] ?? null,
    [people, selectedGmId],
  );

  const selectedPersonRequests = selectedPerson?.requests ?? [];
  const selectedPersonTimeRequests = selectedPerson?.timeRequests ?? [];
  const selectedPersonDeleteRequests = selectedPerson?.deleteRequests ?? [];
  const selectedApplicableIds = selectedPersonRequests
    .filter((request) => selectedIds.has(request.id) && request.autoApplicable)
    .map((request) => request.id);
  const allApplicableIds = selectedPersonRequests.filter((request) => request.autoApplicable).map((request) => request.id);
  const selectedRejectIds = selectedPersonRequests.filter((request) => selectedIds.has(request.id)).map((request) => request.id);

  const setBusy = (ids: string[], busy: boolean) => {
    setBusyIds((current) => {
      const next = new Set(current);
      for (const id of ids) {
        if (busy) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  };

  const runAction = async (ids: string[], action: RequestAction) => {
    const uniqueIds = Array.from(new Set(ids)).filter(Boolean);
    if (uniqueIds.length === 0) return;
    setBusy(uniqueIds, true);
    setError(null);
    try {
      const results = await Promise.allSettled(
        uniqueIds.map((id) =>
          action === "approve"
            ? approveAdminAnswerChangeRequest(id)
            : rejectAdminAnswerChangeRequest(id),
        ),
      );
      const failed = results.filter((result) => result.status === "rejected");
      if (failed.length > 0) {
        const reason = failed[0] as PromiseRejectedResult;
        setError(reason.reason instanceof Error ? reason.reason.message : "Ein Teil der Anfragen konnte nicht verarbeitet werden.");
      }
      setSelectedIds((current) => {
        const next = new Set(current);
        uniqueIds.forEach((id) => next.delete(id));
        return next;
      });
      await loadRequests();
    } finally {
      setBusy(uniqueIds, false);
    }
  };

  const runTimeAction = async (ids: string[], action: RequestAction) => {
    const uniqueIds = Array.from(new Set(ids)).filter(Boolean);
    if (uniqueIds.length === 0) return;
    setBusy(uniqueIds, true);
    setError(null);
    try {
      const results = await Promise.allSettled(
        uniqueIds.map((id) =>
          action === "approve"
            ? approveAdminTimeEntryChangeRequest(id)
            : rejectAdminTimeEntryChangeRequest(id),
        ),
      );
      const failed = results.filter((result) => result.status === "rejected");
      if (failed.length > 0) {
        const reason = failed[0] as PromiseRejectedResult;
        setError(reason.reason instanceof Error ? reason.reason.message : "Ein Teil der Zeitanfragen konnte nicht verarbeitet werden.");
      }
      await loadRequests();
    } finally {
      setBusy(uniqueIds, false);
    }
  };

  const runDeleteAction = async (ids: string[], action: RequestAction) => {
    const uniqueIds = Array.from(new Set(ids)).filter(Boolean);
    if (uniqueIds.length === 0) return;
    setBusy(uniqueIds, true);
    setError(null);
    try {
      const results = await Promise.allSettled(
        uniqueIds.map((id) =>
          action === "approve"
            ? approveAdminVisitSessionDeleteRequest(id)
            : rejectAdminVisitSessionDeleteRequest(id),
        ),
      );
      const failed = results.filter((result) => result.status === "rejected");
      if (failed.length > 0) {
        const reason = failed[0] as PromiseRejectedResult;
        setError(reason.reason instanceof Error ? reason.reason.message : "Ein Teil der Loeschanfragen konnte nicht verarbeitet werden.");
      }
      await loadRequests();
    } finally {
      setBusy(uniqueIds, false);
    }
  };

  const toggleSelected = (requestId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(requestId)) next.delete(requestId);
      else next.add(requestId);
      return next;
    });
  };

  return (
    <div className={`answer-flap ${open ? "is-open" : ""} ${expanded ? "is-expanded" : ""}`}>
      <button
        className="answer-flap-tab"
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={open ? "?nderungsanfragen schließen" : "?nderungsanfragen ?ffnen"}
      >
        {!open ? <span className={`answer-flap-tab-dot ${totalPendingCount > 0 ? "is-hot" : ""}`} /> : null}
        <span className="answer-flap-tab-label">{open ? "Schließen" : "Anfragen"}</span>
        {!open ? <span className="answer-flap-tab-count">{totalPendingCount}</span> : null}
      </button>
        <section className="answer-flap-panel" aria-label="?nderungsanfragen">
          <header className="answer-flap-header">
            <div className="answer-flap-title">
              <div className="answer-flap-eyebrow">Pruefung</div>
              <h2>Antwortprüfung</h2>
              <p>Korrekturen aus Fragebögen und Zeiterfassung.</p>
            </div>
            <div className="answer-flap-header-actions">
              <button type="button" className="answer-icon-button" onClick={() => void loadRequests()} aria-label="Aktualisieren" disabled={loading}>
                {loading ? <Loader2 size={14} className="answer-spin" /> : <RefreshCcw size={14} />}
              </button>
              <button type="button" className="answer-icon-button" onClick={() => setExpanded((value) => !value)} aria-label={expanded ? "Kleiner anzeigen" : "Gr??er anzeigen"}>
                {expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              </button>
              <button type="button" className="answer-icon-button" onClick={() => setOpen(false)} aria-label="Schließen">
                <X size={14} />
              </button>
            </div>
          </header>

          {error ? <div className="answer-error">{error}</div> : null}

          {!expanded ? (
            <div className="answer-compact">
              {loading && requests.length === 0 && timeRequests.length === 0 && deleteRequests.length === 0 ? (
                <div className="answer-empty">
                  <Loader2 className="answer-spin" size={18} />
                  <strong>Anfragen werden geladen</strong>
                  <span>Die neuesten Korrekturen werden abgeglichen.</span>
                </div>
              ) : recentRequests.length === 0 && recentTimeRequests.length === 0 && recentDeleteRequests.length === 0 ? (
                <div className="answer-empty">
                  <Inbox size={20} />
                  <strong>Keine offenen Anfragen</strong>
                  <span>Neue Korrekturen erscheinen automatisch in dieser Liste.</span>
                </div>
              ) : (
                <>
                  {recentRequests.length > 0 ? <div className="answer-section-heading">Fragebogen</div> : null}
                  {recentRequests.map((request) => (
                    <article key={request.id} className={`answer-request-card ${request.status !== "pending" ? "is-muted" : ""}`}>
                      <div className="answer-card-top">
                        <div className="answer-avatar">{initials(request.gm.name)}</div>
                        <div className="answer-card-title">
                          <strong>{request.gm.name}</strong>
                          <span>{marketLabel(request)}</span>
                        </div>
                        <span className={`answer-status is-${request.status}`}>{request.status}</span>
                      </div>
                      <p className="answer-question">{request.questionText}</p>
                      <div className="answer-diff-mini">
                        <span>{currentAnswerLabel(request.currentAnswerSnapshot)}</span>
                        <ChevronRight size={13} />
                        <strong>{request.requestedAnswerSummary}</strong>
                      </div>
                      {request.autoApplicabilityError ? <div className="answer-card-note">{request.autoApplicabilityError}</div> : null}
                      {request.status === "pending" ? (
                        <div className="answer-card-actions">
                          <button
                            type="button"
                            className="answer-secondary-button"
                            onClick={() => void runAction([request.id], "reject")}
                            disabled={busyIds.has(request.id)}
                          >
                            Ablehnen
                          </button>
                          <button
                            type="button"
                            className="answer-primary-button"
                            onClick={() => void runAction([request.id], "approve")}
                            disabled={busyIds.has(request.id) || !request.autoApplicable}
                          >
                            {busyIds.has(request.id) ? <Loader2 size={13} className="answer-spin" /> : <Check size={13} />}
                            Annehmen
                          </button>
                        </div>
                      ) : null}
                    </article>
                  ))}
                  {recentTimeRequests.length > 0 ? <div className="answer-section-heading">Zeiterfassung</div> : null}
                  {recentTimeRequests.map((request) => (
                    <article key={request.id} className={`answer-request-card is-time ${request.status !== "pending" ? "is-muted" : ""}`}>
                      <div className="answer-card-top">
                        <div className="answer-avatar">{initials(request.gm?.name ?? "GM")}</div>
                        <div className="answer-card-title">
                          <strong>{request.gm?.name ?? "Gebietsmanager"}</strong>
                          <span>{request.workDate} · {timeKindLabel(request.sourceKind)}</span>
                        </div>
                        <span className={`answer-status is-${request.status}`}>{request.status}</span>
                      </div>
                      <p className="answer-question">{request.title}</p>
                      <div className="answer-diff-mini">
                        <span>{formatTimeRange(request.originalStartAt, request.originalEndAt)}</span>
                        <ChevronRight size={13} />
                        <strong>{formatTimeRange(request.requestedStartAt, request.requestedEndAt)}</strong>
                      </div>
                      {request.requestNote ? <div className="answer-card-note">{request.requestNote}</div> : null}
                      {request.status === "pending" ? (
                        <div className="answer-card-actions">
                          <button type="button" className="answer-secondary-button" onClick={() => void runTimeAction([request.id], "reject")} disabled={busyIds.has(request.id)}>
                            Ablehnen
                          </button>
                          <button type="button" className="answer-primary-button" onClick={() => void runTimeAction([request.id], "approve")} disabled={busyIds.has(request.id)}>
                            {busyIds.has(request.id) ? <Loader2 size={13} className="answer-spin" /> : <Check size={13} />}
                            Annehmen
                          </button>
                        </div>
                      ) : null}
                    </article>
                  ))}
                  {recentDeleteRequests.length > 0 ? <div className="answer-section-heading">Fragebogen loeschen</div> : null}
                  {recentDeleteRequests.map((request) => (
                    <article key={request.id} className={`answer-request-card is-delete ${request.status !== "pending" ? "is-muted" : ""}`}>
                      <div className="answer-card-top">
                        <div className="answer-avatar">{initials(request.gm.name)}</div>
                        <div className="answer-card-title">
                          <strong>{request.gm.name}</strong>
                          <span>{deleteRequestMarketLabel(request)}</span>
                        </div>
                        <span className={`answer-status is-${request.status}`}>{request.status}</span>
                      </div>
                      <p className="answer-question">Fragebogen aus Auswertungen entfernen</p>
                      <div className="answer-diff-mini">
                        <span>{request.campaignSummary || "Fragebogen"}</span>
                        <ChevronRight size={13} />
                        <strong>Soft delete</strong>
                      </div>
                      {request.requestNote ? <div className="answer-card-note">{request.requestNote}</div> : null}
                      {request.status === "pending" ? (
                        <div className="answer-card-actions">
                          <button type="button" className="answer-secondary-button" onClick={() => void runDeleteAction([request.id], "reject")} disabled={busyIds.has(request.id)}>
                            Ablehnen
                          </button>
                          <button type="button" className="answer-primary-button is-danger" onClick={() => void runDeleteAction([request.id], "approve")} disabled={busyIds.has(request.id)}>
                            {busyIds.has(request.id) ? <Loader2 size={13} className="answer-spin" /> : <Trash2 size={13} />}
                            Loeschen
                          </button>
                        </div>
                      ) : null}
                    </article>
                  ))}
                </>
              )}
            </div>
          ) : (
            <div className="answer-expanded">
              <aside className="answer-people">
                <div className="answer-pane-title">Personen</div>
                {people.length === 0 ? (
                  <div className="answer-empty is-small">Keine offenen Personen.</div>
                ) : (
                  people.map((person) => (
                    <button
                      key={person.id}
                      type="button"
                      className={`answer-person ${selectedPerson?.id === person.id ? "is-active" : ""}`}
                      onClick={() => {
                        setSelectedGmId(person.id);
                        setSelectedIds(new Set());
                      }}
                    >
                      <span className="answer-avatar is-small">{initials(person.name)}</span>
                      <span className="answer-person-main">
                        <strong>{person.name}</strong>
                        <small>{person.region ?? person.email}</small>
                      </span>
                      <span className="answer-person-count">{person.requests.length + person.timeRequests.length + person.deleteRequests.length}</span>
                    </button>
                  ))
                )}
              </aside>

              <section className="answer-person-detail">
                {selectedPerson ? (
                  <>
                    <div className="answer-person-header">
                      <div>
                        <div className="answer-pane-title">Pruefung pro GM</div>
                        <h3>{selectedPerson.name}</h3>
                        <p>{selectedPerson.requests.length + selectedPerson.timeRequests.length + selectedPerson.deleteRequests.length} offene Anfrage{selectedPerson.requests.length + selectedPerson.timeRequests.length + selectedPerson.deleteRequests.length === 1 ? "" : "n"}</p>
                      </div>
                      <div className="answer-bulk-actions">
                        <button
                          type="button"
                          className="answer-secondary-button"
                          onClick={() => void runAction(selectedRejectIds, "reject")}
                          disabled={selectedRejectIds.length === 0}
                        >
                          Auswahl ablehnen
                        </button>
                        <button
                          type="button"
                          className="answer-primary-button"
                          onClick={() => void runAction(selectedApplicableIds, "approve")}
                          disabled={selectedApplicableIds.length === 0}
                        >
                          <Check size={13} />
                          Auswahl annehmen
                        </button>
                        <button
                          type="button"
                          className="answer-primary-button is-dark"
                          onClick={() => void runAction(allApplicableIds, "approve")}
                          disabled={allApplicableIds.length === 0}
                        >
                          <CheckCheck size={13} />
                          Alle annehmen
                        </button>
                      </div>
                    </div>

                    <div className="answer-section-heading is-expanded">Fragebogen</div>
                    <div className="answer-detail-list">
                      {selectedPersonRequests.length === 0 ? (
                        <div className="answer-empty is-small">Keine offenen Fragebogen-Anfragen.</div>
                      ) : null}
                      {selectedPersonRequests.map((request) => {
                        const checked = selectedIds.has(request.id);
                        return (
                          <article key={request.id} className={`answer-detail-card ${checked ? "is-selected" : ""}`}>
                            <label className="answer-select-row">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleSelected(request.id)}
                              />
                              <span>
                                <strong>{marketLabel(request)}</strong>
                                <small>
                                  {sectionLabel(request.section.section)} · {formatDateTime(request.session.submittedAt)} · {request.section.campaignName}
                                </small>
                              </span>
                              <span className="answer-time">
                                <Clock3 size={12} />
                                {formatDateTime(request.createdAt)}
                              </span>
                            </label>

                            <p className="answer-question is-detail">{request.questionText}</p>
                            <div className="answer-diff-grid">
                              <div>
                                <span>Aktuell</span>
                                <strong>{currentAnswerLabel(request.currentAnswerSnapshot)}</strong>
                              </div>
                              <div>
                                <span>Angefragt</span>
                                <strong>{request.requestedAnswerSummary}</strong>
                              </div>
                            </div>
                            {request.requestNote ? <p className="answer-note">{request.requestNote}</p> : null}
                            {!request.autoApplicable ? <div className="answer-warning">{request.autoApplicabilityError}</div> : null}
                          </article>
                        );
                      })}
                    </div>
                    <div className="answer-section-heading is-expanded">Zeiterfassung</div>
                    <div className="answer-detail-list">
                      {selectedPersonTimeRequests.length === 0 ? (
                        <div className="answer-empty is-small">Keine offenen Zeiterfassungs-Anfragen.</div>
                      ) : null}
                      {selectedPersonTimeRequests.map((request) => (
                        <article key={request.id} className="answer-detail-card is-time">
                          <div className="answer-select-row">
                            <span>
                              <strong>{request.title}</strong>
                              <small>
                                {request.workDate} · {timeKindLabel(request.sourceKind)}
                                {request.subtitle ? ` · ${request.subtitle}` : ""}
                              </small>
                            </span>
                            <span className="answer-time">
                              <Clock3 size={12} />
                              {formatDateTime(request.createdAt)}
                            </span>
                          </div>

                          <div className="answer-diff-grid">
                            <div>
                              <span>Original</span>
                              <strong>{formatTimeRange(request.originalStartAt, request.originalEndAt)}</strong>
                            </div>
                            <div>
                              <span>Angefragt</span>
                              <strong>{formatTimeRange(request.requestedStartAt, request.requestedEndAt)}</strong>
                            </div>
                          </div>
                          {request.requestNote ? <p className="answer-note">{request.requestNote}</p> : null}
                          <div className="answer-card-actions">
                            <button type="button" className="answer-secondary-button" onClick={() => void runTimeAction([request.id], "reject")} disabled={busyIds.has(request.id)}>
                              Ablehnen
                            </button>
                            <button type="button" className="answer-primary-button" onClick={() => void runTimeAction([request.id], "approve")} disabled={busyIds.has(request.id)}>
                              {busyIds.has(request.id) ? <Loader2 size={13} className="answer-spin" /> : <Check size={13} />}
                              Annehmen
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                    <div className="answer-section-heading is-expanded">Fragebogen loeschen</div>
                    <div className="answer-detail-list">
                      {selectedPersonDeleteRequests.length === 0 ? (
                        <div className="answer-empty is-small">Keine offenen Loeschanfragen.</div>
                      ) : null}
                      {selectedPersonDeleteRequests.map((request) => (
                        <article key={request.id} className="answer-detail-card is-delete">
                          <div className="answer-select-row">
                            <span>
                              <strong>{deleteRequestMarketLabel(request)}</strong>
                              <small>
                                {request.campaignSummary || "Fragebogen"} Â· {formatDateTime(request.session.submittedAt)}
                              </small>
                            </span>
                            <span className="answer-time">
                              <Clock3 size={12} />
                              {formatDateTime(request.createdAt)}
                            </span>
                          </div>

                          <div className="answer-diff-grid">
                            <div>
                              <span>Aktuell</span>
                              <strong>In Auswertungen enthalten</strong>
                            </div>
                            <div>
                              <span>Angefragt</span>
                              <strong>Besuch entfernen</strong>
                            </div>
                          </div>
                          {request.requestNote ? <p className="answer-note">{request.requestNote}</p> : null}
                          <div className="answer-card-actions">
                            <button type="button" className="answer-secondary-button" onClick={() => void runDeleteAction([request.id], "reject")} disabled={busyIds.has(request.id)}>
                              Ablehnen
                            </button>
                            <button type="button" className="answer-primary-button is-danger" onClick={() => void runDeleteAction([request.id], "approve")} disabled={busyIds.has(request.id)}>
                              {busyIds.has(request.id) ? <Loader2 size={13} className="answer-spin" /> : <Trash2 size={13} />}
                              Loeschen
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="answer-empty">
                    <UserRound size={20} />
                    <strong>Keine offenen Anfragen</strong>
                    <span>Es gibt aktuell keine Person mit offenen Korrekturen.</span>
                  </div>
                )}
              </section>
            </div>
          )}
        </section>

      <style jsx>{`
        .answer-flap {
          position: fixed;
          top: 16px;
          right: 0;
          z-index: 90;
          font-family: var(--font-inter), Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          color: #101828;
          display: flex;
          align-items: center;
          --answer-panel-width: 390px;
          transform: translateX(var(--answer-panel-width));
          transition: transform 0.28s cubic-bezier(0.22, 1, 0.36, 1);
          will-change: transform;
        }

        .answer-flap:not(.is-open):hover {
          transform: translateX(calc(var(--answer-panel-width) - 10px));
        }

        .answer-flap.is-open {
          transform: translateX(0);
        }

        .answer-flap.is-expanded {
          --answer-panel-width: min(860px, calc(100vw - 92px));
        }

        .answer-flap-tab {
          width: 32px;
          min-height: 174px;
          padding: 16px 0 13px;
          border: 1px solid rgba(16, 24, 40, 0.07);
          border-right: 1px solid rgba(16, 24, 40, 0.06);
          border-radius: 15px 0 0 15px;
          background: rgba(255, 255, 255, 0.9);
          box-shadow: 0 12px 30px rgba(16, 24, 40, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.88);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          cursor: pointer;
          backdrop-filter: blur(18px);
          transition: box-shadow 0.16s ease, background 0.16s ease;
          flex: 0 0 auto;
        }

        .answer-flap-tab:hover {
          background: rgba(255, 255, 255, 0.96);
          box-shadow: 0 16px 36px rgba(16, 24, 40, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.92);
        }

        .answer-flap-tab-dot {
          width: 6px;
          height: 6px;
          border-radius: 999px;
          background: #d71920;
        }

        .answer-flap-tab-dot.is-hot {
          background: #079b73;
          box-shadow: 0 0 8px rgba(7, 155, 115, 0.24);
        }

        .answer-flap.is-open .answer-flap-tab {
          background: rgba(255, 255, 255, 0.96);
          box-shadow: 0 18px 38px rgba(16, 24, 40, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.92);
          justify-content: center;
          padding: 0;
        }

        .answer-flap.is-open .answer-flap-tab-label {
          color: rgba(16, 24, 40, 0.5);
        }

        .answer-flap.is-open .answer-flap-tab:hover .answer-flap-tab-label {
          color: rgba(16, 24, 40, 0.64);
        }

        .answer-flap-tab-count {
          min-width: 20px;
          height: 20px;
          padding: 0 5px;
          border-radius: 999px;
          border: 1px solid rgba(16, 24, 40, 0.075);
          background: rgba(16, 24, 40, 0.035);
          display: grid;
          place-items: center;
          font-size: 10px;
          font-weight: 650;
          color: rgba(16, 24, 40, 0.46);
          line-height: 1;
        }

        .answer-flap-tab-label {
          writing-mode: vertical-rl;
          transform: rotate(180deg);
          font-size: 10.5px;
          font-weight: 620;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: rgba(16, 24, 40, 0.42);
          line-height: 1;
        }

        .answer-flap-panel {
          width: var(--answer-panel-width);
          max-height: calc(100vh - 32px);
          border: 1px solid rgba(16, 24, 40, 0.08);
          border-right: none;
          border-radius: 22px 0 0 22px;
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(251, 252, 253, 0.97) 100%);
          box-shadow: 0 26px 70px rgba(16, 24, 40, 0.16), inset 0 1px 0 rgba(255, 255, 255, 0.92);
          overflow: hidden;
          backdrop-filter: blur(18px);
          flex: 0 0 auto;
        }

        .is-expanded .answer-flap-panel {
          height: min(740px, calc(100vh - 32px));
        }

        .answer-flap-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 19px 18px 16px;
          border-bottom: 1px solid rgba(16, 24, 40, 0.055);
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.84), rgba(255, 255, 255, 0.52));
        }

        .answer-flap-eyebrow,
        .answer-pane-title {
          font-size: 9.5px;
          font-weight: 760;
          letter-spacing: 0.115em;
          text-transform: uppercase;
          color: rgba(16, 24, 40, 0.38);
        }

        .answer-flap-title {
          min-width: 0;
          display: grid;
          gap: 2px;
        }

        .answer-flap-header h2 {
          margin: 3px 0 0;
          font-size: 16px;
          font-weight: 760;
          letter-spacing: 0;
          color: rgba(16, 24, 40, 0.9);
        }

        .answer-person-header h3 {
          margin: 3px 0 0;
          font-size: 17px;
          font-weight: 820;
          letter-spacing: 0;
          color: rgba(16, 24, 40, 0.92);
        }

        .answer-flap-title p {
          margin: 0;
          font-size: 10.5px;
          font-weight: 620;
          color: rgba(16, 24, 40, 0.44);
          white-space: nowrap;
        }

        .answer-flap-header-actions,
        .answer-card-actions,
        .answer-bulk-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .answer-status {
          border-radius: 999px;
          background: rgba(239, 43, 45, 0.07);
          color: rgba(215, 25, 32, 0.88);
          padding: 6px 9px;
          font-size: 10px;
          font-weight: 780;
          line-height: 1;
        }

        .answer-icon-button {
          width: 28px;
          height: 28px;
          border-radius: 9px;
          border: 1px solid rgba(16, 24, 40, 0.075);
          background: rgba(255, 255, 255, 0.86);
          color: rgba(16, 24, 40, 0.56);
          display: grid;
          place-items: center;
          cursor: pointer;
          box-shadow: 0 2px 7px rgba(16, 24, 40, 0.04);
        }

        .answer-icon-button:hover {
          color: rgba(16, 24, 40, 0.78);
          background: #fff;
        }

        .answer-icon-button:disabled,
        .answer-primary-button:disabled,
        .answer-secondary-button:disabled {
          opacity: 0.48;
          cursor: not-allowed;
        }

        .answer-error,
        .answer-warning,
        .answer-card-note {
          margin: 12px 18px 0;
          border-radius: 12px;
          border: 1px solid rgba(215, 25, 32, 0.16);
          background: linear-gradient(180deg, rgba(215, 25, 32, 0.055), rgba(215, 25, 32, 0.035));
          padding: 10px 12px;
          color: rgba(177, 24, 31, 0.92);
          font-size: 11px;
          font-weight: 720;
          line-height: 1.45;
        }

        .answer-card-note,
        .answer-warning {
          margin: 8px 0 0;
        }

        .answer-compact {
          padding: 14px;
          display: grid;
          gap: 10px;
          max-height: calc(100vh - 196px);
          overflow-y: auto;
        }

        .answer-section-heading {
          margin: 4px 2px 0;
          font-size: 9px;
          font-weight: 820;
          letter-spacing: 0.11em;
          text-transform: uppercase;
          color: rgba(16, 24, 40, 0.38);
        }

        .answer-section-heading.is-expanded {
          margin: 16px 0 9px;
        }

        .answer-empty {
          min-height: 170px;
          border-radius: 18px;
          border: 1px solid rgba(16, 24, 40, 0.07);
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.74), rgba(248, 250, 252, 0.82));
          color: rgba(16, 24, 40, 0.45);
          display: grid;
          place-items: center;
          align-content: center;
          gap: 7px;
          font-size: 11px;
          font-weight: 650;
          text-align: center;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.78);
        }

        .answer-empty svg {
          color: rgba(16, 24, 40, 0.38);
          margin-bottom: 4px;
        }

        .answer-empty strong {
          font-size: 12px;
          font-weight: 760;
          color: rgba(16, 24, 40, 0.58);
        }

        .answer-empty span {
          max-width: 250px;
          font-size: 10.5px;
          line-height: 1.45;
          font-weight: 600;
          color: rgba(16, 24, 40, 0.38);
        }

        .answer-empty.is-small {
          min-height: 88px;
          margin-top: 10px;
        }

        .answer-request-card,
        .answer-detail-card {
          border: 1px solid rgba(16, 24, 40, 0.07);
          border-radius: 18px;
          background: #fff;
          padding: 13px;
          box-shadow: 0 6px 18px rgba(16, 24, 40, 0.05);
        }

        .answer-request-card.is-muted {
          opacity: 0.58;
        }

        .answer-request-card.is-time,
        .answer-detail-card.is-time {
          border-color: rgba(59, 130, 246, 0.12);
          background: linear-gradient(180deg, #ffffff, rgba(248, 250, 252, 0.9));
        }

        .answer-request-card.is-delete,
        .answer-detail-card.is-delete {
          border-color: rgba(215, 25, 32, 0.14);
          background: linear-gradient(180deg, #ffffff, rgba(255, 245, 245, 0.72));
        }

        .answer-card-top,
        .answer-select-row {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .answer-avatar {
          width: 36px;
          height: 36px;
          border-radius: 14px;
          background: linear-gradient(145deg, rgba(239, 43, 45, 0.13), rgba(255, 255, 255, 0.95));
          border: 1px solid rgba(239, 43, 45, 0.14);
          display: grid;
          place-items: center;
          color: #d71920;
          font-size: 11px;
          font-weight: 950;
          flex: 0 0 auto;
        }

        .answer-avatar.is-small {
          width: 30px;
          height: 30px;
          border-radius: 11px;
        }

        .answer-card-title {
          min-width: 0;
          flex: 1;
          display: grid;
          gap: 2px;
        }

        .answer-card-title strong,
        .answer-person-main strong,
        .answer-select-row strong {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 12px;
          font-weight: 900;
          color: #111827;
        }

        .answer-card-title span,
        .answer-person-main small,
        .answer-select-row small,
        .answer-person-header p {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 10px;
          font-weight: 750;
          color: rgba(16, 24, 40, 0.48);
        }

        .answer-status.is-approved {
          background: rgba(0, 158, 107, 0.1);
          color: #00895e;
        }

        .answer-status.is-rejected,
        .answer-status.is-cancelled {
          background: rgba(16, 24, 40, 0.07);
          color: rgba(16, 24, 40, 0.56);
        }

        .answer-question {
          margin: 11px 0 8px;
          font-size: 11px;
          line-height: 1.45;
          font-weight: 800;
          color: rgba(16, 24, 40, 0.75);
        }

        .answer-question.is-detail {
          margin: 12px 0;
        }

        .answer-diff-mini {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
          align-items: center;
          gap: 8px;
          border-radius: 13px;
          background: #f8fafc;
          padding: 9px 10px;
          font-size: 10px;
          font-weight: 800;
          color: rgba(16, 24, 40, 0.52);
        }

        .answer-diff-mini span,
        .answer-diff-mini strong {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .answer-diff-mini strong {
          color: #d71920;
        }

        .answer-primary-button,
        .answer-secondary-button {
          height: 32px;
          border-radius: 11px;
          padding: 0 12px;
          font-size: 11px;
          font-weight: 900;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          cursor: pointer;
          transition: transform 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease;
        }

        .answer-primary-button {
          border: 1px solid rgba(188, 16, 24, 0.28);
          background: linear-gradient(180deg, #ef3436 0%, #d71920 100%);
          color: #fff;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.36), 0 10px 22px rgba(215, 25, 32, 0.18);
        }

        .answer-primary-button.is-dark {
          border-color: rgba(16, 24, 40, 0.18);
          background: linear-gradient(180deg, #111827 0%, #060b16 100%);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.18), 0 10px 20px rgba(16, 24, 40, 0.14);
        }

        .answer-primary-button.is-danger {
          border-color: rgba(188, 16, 24, 0.3);
          background: linear-gradient(180deg, #ee3436 0%, #c91820 100%);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.34), 0 10px 22px rgba(215, 25, 32, 0.2);
        }

        .answer-secondary-button {
          border: 1px solid rgba(16, 24, 40, 0.08);
          background: #fff;
          color: rgba(16, 24, 40, 0.7);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9), 0 6px 14px rgba(16, 24, 40, 0.06);
        }

        .answer-card-actions {
          justify-content: flex-end;
          margin-top: 10px;
        }

        .answer-expanded {
          height: calc(100% - 65px);
          display: grid;
          grid-template-columns: 260px minmax(0, 1fr);
        }

        .answer-people {
          border-right: 1px solid rgba(16, 24, 40, 0.06);
          padding: 16px;
          overflow-y: auto;
          background: rgba(248, 250, 252, 0.58);
        }

        .answer-person {
          width: 100%;
          border: 1px solid transparent;
          border-radius: 15px;
          background: transparent;
          padding: 9px;
          display: flex;
          align-items: center;
          gap: 9px;
          cursor: pointer;
          text-align: left;
        }

        .answer-person.is-active {
          border-color: rgba(239, 43, 45, 0.14);
          background: rgba(239, 43, 45, 0.06);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.75);
        }

        .answer-person-main {
          min-width: 0;
          flex: 1;
          display: grid;
          gap: 2px;
        }

        .answer-person-count {
          min-width: 24px;
          height: 24px;
          border-radius: 999px;
          background: #fff;
          border: 1px solid rgba(16, 24, 40, 0.07);
          display: grid;
          place-items: center;
          font-size: 10px;
          font-weight: 950;
          color: #d71920;
        }

        .answer-person-detail {
          min-width: 0;
          padding: 16px;
          overflow-y: auto;
        }

        .answer-person-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          margin-bottom: 14px;
        }

        .answer-bulk-actions {
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .answer-detail-list {
          display: grid;
          gap: 10px;
        }

        .answer-detail-card.is-selected {
          border-color: rgba(239, 43, 45, 0.22);
          box-shadow: 0 10px 26px rgba(239, 43, 45, 0.08);
        }

        .answer-select-row input {
          width: 16px;
          height: 16px;
          accent-color: #d71920;
          flex: 0 0 auto;
        }

        .answer-select-row span:nth-child(2) {
          display: grid;
          gap: 2px;
          min-width: 0;
          flex: 1;
        }

        .answer-time {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 10px;
          font-weight: 800;
          color: rgba(16, 24, 40, 0.44);
          white-space: nowrap;
        }

        .answer-diff-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }

        .answer-diff-grid div {
          min-width: 0;
          border-radius: 14px;
          background: #f8fafc;
          border: 1px solid rgba(16, 24, 40, 0.05);
          padding: 10px;
          display: grid;
          gap: 4px;
        }

        .answer-diff-grid span {
          font-size: 9px;
          font-weight: 900;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: rgba(16, 24, 40, 0.38);
        }

        .answer-diff-grid strong {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 12px;
          font-weight: 900;
          color: #111827;
        }

        .answer-diff-grid div:nth-child(2) strong {
          color: #d71920;
        }

        .answer-note {
          margin: 9px 0 0;
          font-size: 11px;
          line-height: 1.45;
          color: rgba(16, 24, 40, 0.58);
          font-weight: 750;
        }

        .answer-spin {
          animation: answer-spin 0.85s linear infinite;
        }

        @keyframes answer-spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 980px) {
          .answer-flap.is-expanded {
            --answer-panel-width: calc(100vw - 44px);
          }

          .answer-expanded {
            grid-template-columns: 1fr;
          }

          .answer-people {
            border-right: none;
            border-bottom: 1px solid rgba(16, 24, 40, 0.06);
            max-height: 190px;
          }

          .answer-person-header {
            display: grid;
          }
        }
      `}</style>
    </div>
  );
}
