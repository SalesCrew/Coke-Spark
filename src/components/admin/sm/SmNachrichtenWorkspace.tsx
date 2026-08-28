"use client";

import { memo, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Check,
  ChevronDown,
  MoreHorizontal,
  RotateCcw,
  Search,
  Send,
  X,
} from "lucide-react";
import { fetchAdminSmMessages, sendAdminSmMessage } from "@/lib/api/backend";
import type {
  SmAdminMessage as MessageCampaign,
  SmAdminMessageRecipient as MessageRecipient,
  SmMessageDirectoryRecipient as Recipient,
} from "@/types/smMessages";

const RED = "#DC2626";

type RecipientFilter = "all" | "read" | "unread";
type MessageFilter = "all" | "complete" | "open";
type MessageSort = "newest" | "oldest";

const MESSAGE_FILTER_OPTIONS: readonly { value: MessageFilter; label: string }[] = [
  { value: "all", label: "Alle Status" },
  { value: "open", label: "Mit ungelesenen" },
  { value: "complete", label: "Vollständig gelesen" },
];

const MESSAGE_SORT_OPTIONS: readonly { value: MessageSort; label: string }[] = [
  { value: "newest", label: "Neueste zuerst" },
  { value: "oldest", label: "Älteste zuerst" },
];

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toLocaleUpperCase("de-AT") ?? "").join("") || "SM";
}

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("de-AT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function visibilityLabel(days: number | null): string {
  if (days === null) return "Dauerhaft sichtbar (Bestand)";
  if (days === 0) return "Einmal lesbar";
  return `${days} ${days === 1 ? "Tag" : "Tage"} nach Gelesen sichtbar`;
}

function readCount(message: MessageCampaign): number {
  return message.recipients.reduce((sum, recipient) => sum + (recipient.readAt ? 1 : 0), 0);
}

function readPercent(message: MessageCampaign): number {
  if (message.recipients.length === 0) return 0;
  return Math.round((readCount(message) / message.recipients.length) * 100);
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase("de-AT");
}

function readState(message: MessageCampaign, recipientId: string): MessageRecipient | null {
  return message.recipients.find((recipient) => recipient.recipientId === recipientId) ?? null;
}

const SectionLabel = memo(function SectionLabel({ children }: { children: React.ReactNode }) {
  return <span className="sm-message-section-label">{children}</span>;
});

const StatusBadge = memo(function StatusBadge({ read }: { read: boolean }) {
  return (
    <span className={read ? "sm-message-badge sm-message-badge-read" : "sm-message-badge sm-message-badge-unread"}>
      {read ? "Gelesen" : "Ungelesen"}
    </span>
  );
});

const MessageListRow = memo(function MessageListRow({
  message,
  active,
  onSelect,
}: {
  message: MessageCampaign;
  active: boolean;
  onSelect: () => void;
}) {
  const read = readCount(message);
  return (
    <button type="button" onClick={onSelect} className={`sm-message-list-row${active ? " is-active" : ""}`}>
      <span className="sm-message-list-subject">{message.subject}</span>
      <span className="sm-message-list-meta">{formatDateTime(message.sentAt)} <i /> {message.recipients.length} Empfänger</span>
      <span className="sm-message-list-ratio">{read}/{message.recipients.length} gelesen</span>
      <span className="sm-message-progress"><span style={{ width: `${readPercent(message)}%` }} /></span>
    </button>
  );
});

function FilterButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`sm-message-filter${active ? " is-active" : ""}`}>{label}</button>;
}

function MessageSelectDropdown<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const selectedLabel = options.find((option) => option.value === value)?.label ?? options[0]?.label ?? "";

  useEffect(() => {
    if (!open) return;
    const updatePosition = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const width = Math.max(rect.width, 172);
      setPosition({
        top: rect.bottom + 4,
        left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
        width,
      });
    };
    const closeOutside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("pointerdown", closeOutside);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("pointerdown", closeOutside);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`sm-message-select${open ? " is-open" : ""}`}
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span>{selectedLabel}</span>
        <ChevronDown size={10} className={open ? "is-open" : ""} />
      </button>
      {open && position && typeof document !== "undefined" ? createPortal(
        <div
          ref={menuRef}
          className="sm-message-select-menu"
          style={{ top: position.top, left: position.left, width: position.width }}
          role="listbox"
        >
          {options.map((option) => {
            const selected = option.value === value;
            return (
              <button
                type="button"
                role="option"
                aria-selected={selected}
                className={selected ? "is-selected" : ""}
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                <span>{option.label}</span>
                {selected ? <Check size={10} strokeWidth={2.5} /> : null}
              </button>
            );
          })}
        </div>,
        document.body,
      ) : null}
    </>
  );
}

function RecipientActionMenu({
  recipient,
  onCompose,
}: {
  recipient: Recipient;
  onCompose: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const updatePosition = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const width = 174;
      const estimatedHeight = 37;
      const opensUpward = rect.bottom + estimatedHeight + 8 > window.innerHeight;
      setPosition({
        top: opensUpward ? rect.top - estimatedHeight - 4 : rect.bottom + 4,
        left: Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8)),
        width,
      });
    };
    const closeOutside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("pointerdown", closeOutside);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("pointerdown", closeOutside);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={`Aktionen für ${recipient.name}`}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`sm-message-icon-button${open ? " is-open" : ""}`}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((current) => !current);
        }}
      >
        <MoreHorizontal size={13} />
      </button>
      {open && position && typeof document !== "undefined" ? createPortal(
        <div ref={menuRef} className="sm-message-recipient-menu" style={position} role="menu">
          <button type="button" role="menuitem" onClick={() => { onCompose(); setOpen(false); }}>Neue Nachricht schreiben</button>
        </div>,
        document.body,
      ) : null}
    </>
  );
}

function RecipientTable({
  message,
  selectedRecipientId,
  onSelectRecipient,
  onComposeRecipient,
}: {
  message: MessageCampaign;
  selectedRecipientId: string | null;
  onSelectRecipient: (recipientId: string) => void;
  onComposeRecipient: (recipientId: string) => void;
}) {
  const [filter, setFilter] = useState<RecipientFilter>("all");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);

  const rows = useMemo(() => {
    const query = normalize(deferredSearch);
    return message.recipients.filter((state) => {
      if (filter === "read" && !state.readAt) return false;
      if (filter === "unread" && state.readAt) return false;
      if (query && !normalize(`${state.name} ${state.email}`).includes(query)) return false;
      return true;
    });
  }, [deferredSearch, filter, message.recipients]);

  return (
    <div className="sm-message-recipients">
      <div className="sm-message-recipients-toolbar">
        <div className="sm-message-recipient-filters">
          <FilterButton label="Alle" active={filter === "all"} onClick={() => setFilter("all")} />
          <FilterButton label="Gelesen" active={filter === "read"} onClick={() => setFilter("read")} />
          <FilterButton label="Ungelesen" active={filter === "unread"} onClick={() => setFilter("unread")} />
        </div>
        <label className="sm-message-search sm-message-recipient-search">
          <Search size={11} strokeWidth={2} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Empfänger suchen…" />
          {search ? <button type="button" aria-label="Suche leeren" onClick={() => setSearch("")}><X size={10} /></button> : null}
        </label>
      </div>

      <div className="sm-message-table-header">
        <span>Shelf Merchandiser</span><span>E-Mail</span><span>Zustellung</span><span>Lesestatus</span><span>Gelesen am</span><span />
      </div>
      <div className="sm-message-table-body">
        {rows.map((state) => {
          const selected = state.recipientId === selectedRecipientId;
          return (
            <div
              key={state.recipientId}
              className={`sm-message-table-row${selected ? " is-selected" : ""}`}
              role="button"
              tabIndex={0}
              aria-pressed={selected}
              onClick={() => onSelectRecipient(state.recipientId)}
              onKeyDown={(event) => {
                if (event.target !== event.currentTarget) return;
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelectRecipient(state.recipientId);
                }
              }}
            >
              <div className="sm-message-person"><span>{initials(state.name)}</span><strong>{state.name}</strong></div>
              <span>{state.email}</span>
              <span className="sm-message-delivered"><Check size={10} strokeWidth={2.2} /> Zugestellt</span>
              <span><StatusBadge read={Boolean(state.readAt)} /></span>
              <span className="sm-message-date">{formatDateTime(state.readAt)}</span>
              <RecipientActionMenu
                recipient={{ id: state.recipientId, name: state.name, email: state.email }}
                onCompose={() => onComposeRecipient(state.recipientId)}
              />
            </div>
          );
        })}
        {rows.length === 0 ? <div className="sm-message-empty">Keine passenden Empfänger gefunden.</div> : null}
      </div>
    </div>
  );
}

function ReadSummary({ message, messages, selectedRecipientId, onResend }: { message: MessageCampaign; messages: MessageCampaign[]; selectedRecipientId: string | null; onResend: () => void }) {
  const read = readCount(message);
  const total = message.recipients.length;
  const percent = readPercent(message);
  const focusRecipientId = selectedRecipientId && readState(message, selectedRecipientId)
    ? selectedRecipientId
    : message.recipients[0]?.recipientId;
  const focusRecipient = focusRecipientId ? readState(message, focusRecipientId) : null;
  const parallelMessages = focusRecipientId
    ? messages.filter((candidate) => candidate.id !== message.id && readState(candidate, focusRecipientId)).slice(0, 1)
    : [];

  return (
    <>
      <section className="sm-message-summary-card">
        <SectionLabel>Zusammenfassung</SectionLabel>
        <div className="sm-message-summary-main">
          <div className="sm-message-ring" style={{ "--read-progress": `${percent * 3.6}deg` } as React.CSSProperties}>
            <div><strong>{read} von {total}</strong><span>gelesen</span></div>
          </div>
        <div className="sm-message-summary-values">
            <span><i className="green" /><strong>{total}</strong> Empfänger</span>
            <span><i /><strong>{total}</strong> zugestellt</span>
            <span><i className="amber" /><strong>{total - read}</strong> ungelesen</span>
          </div>
        </div>
        <div className="sm-message-visibility-summary">{visibilityLabel(message.visibleAfterReadDays)}</div>
        <div className="sm-message-summary-actions">
          <button type="button" onClick={onResend}><RotateCcw size={11} /> Erneut senden</button>
          <button type="button" aria-label="Weitere Aktionen"><MoreHorizontal size={13} /></button>
        </div>
      </section>

      <section className="sm-message-parallel-card">
        <SectionLabel>Auch aktiv für {focusRecipient?.name.split(" ")[0] ?? "diese Person"}</SectionLabel>
        <p>{focusRecipient?.name ?? "Die Person"} hat weitere aktive Nachrichten.</p>
        {parallelMessages.map((candidate) => {
          const state = readState(candidate, focusRecipientId!);
          const read = readCount(candidate);
          return (
            <div key={candidate.id} className="sm-message-parallel-item">
              <div className="sm-message-parallel-title"><strong>{candidate.subject}</strong><StatusBadge read={Boolean(state?.readAt)} /></div>
              <span>Gesendet: {formatDateTime(candidate.sentAt)}</span>
              <span>Lesestatus: {read}/{candidate.recipients.length} gelesen</span>
              <div className="sm-message-progress"><span style={{ width: `${readPercent(candidate)}%` }} /></div>
            </div>
          );
        })}
      </section>
    </>
  );
}

function Composer({
  recipients,
  onSend,
}: {
  recipients: Recipient[];
  onSend: (subject: string, body: string, recipientIds: string[], idempotencyKey: string, visibleAfterReadDays: number) => Promise<void>;
}) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [recipientIds, setRecipientIds] = useState<string[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [mode, setMode] = useState<"all" | "individual">("individual");
  const [keepVisibleAfterRead, setKeepVisibleAfterRead] = useState(true);
  const [visibleAfterReadDays, setVisibleAfterReadDays] = useState(7);
  const [sending, setSending] = useState(false);
  const subjectRef = useRef<HTMLInputElement | null>(null);
  const idempotencyKeyRef = useRef<string | null>(null);
  const recipientById = useMemo(() => new Map(recipients.map((recipient) => [recipient.id, recipient])), [recipients]);

  const displayedIds = recipientIds.slice(0, 2);
  const remaining = recipientIds.length - displayedIds.length;
  const canSend = !sending && subject.trim().length > 0 && body.trim().length > 0 && recipientIds.length > 0;

  useEffect(() => {
    idempotencyKeyRef.current = null;
  }, [body, keepVisibleAfterRead, recipientIds, subject, visibleAfterReadDays]);

  useEffect(() => {
    const focusComposer = (event: Event) => {
      const recipientId = (event as CustomEvent<{ recipientId?: string }>).detail?.recipientId;
      if (recipientId && recipientById.has(recipientId)) {
        setRecipientIds([recipientId]);
        setMode("individual");
        setPickerOpen(false);
      }
      subjectRef.current?.focus();
    };
    window.addEventListener("sm-nachrichten:openComposer", focusComposer);
    return () => window.removeEventListener("sm-nachrichten:openComposer", focusComposer);
  }, [recipientById]);

  const toggleRecipient = (recipientId: string) => {
    setMode("individual");
    setRecipientIds((current) => current.includes(recipientId) ? current.filter((id) => id !== recipientId) : [...current, recipientId]);
  };

  const changeMode = (nextMode: "all" | "individual") => {
    setMode(nextMode);
    if (nextMode === "all") setRecipientIds(recipients.map((recipient) => recipient.id));
  };

  const submit = async () => {
    if (!canSend) return;
    setSending(true);
    try {
      const idempotencyKey = idempotencyKeyRef.current ?? crypto.randomUUID();
      idempotencyKeyRef.current = idempotencyKey;
      await onSend(subject, body, recipientIds, idempotencyKey, keepVisibleAfterRead ? visibleAfterReadDays : 0);
      idempotencyKeyRef.current = null;
      setSubject("");
      setBody("");
      setRecipientIds([]);
      setMode("individual");
      setKeepVisibleAfterRead(true);
      setVisibleAfterReadDays(7);
      setPickerOpen(false);
    } catch {
      // The parent owns the visible error. Keep the draft and idempotency key for a safe retry.
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="sm-message-compose is-open">
      <div className="sm-message-compose-heading">
        <SectionLabel>Neue Nachricht erstellen</SectionLabel>
      </div>
      <div className="sm-message-compose-body">
          <label><span>Betreff</span><input ref={subjectRef} value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Betreff eingeben…" /></label>
          <label><span>Nachricht</span><textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder="Nachricht verfassen…" rows={5} /></label>
          <div className="sm-message-compose-field">
            <span>Empfänger</span>
            <div className="sm-message-recipient-picker">
              <button type="button" onClick={() => setPickerOpen((current) => !current)} className="sm-message-recipient-trigger">
                <span className="sm-message-selected-recipients">
                  {displayedIds.map((id) => <i key={id}>{recipientById.get(id)?.name}</i>)}
                  {remaining > 0 ? <i>+ {remaining} weitere</i> : null}
                  {recipientIds.length === 0 ? <em>Empfänger auswählen…</em> : null}
                </span>
                <ChevronDown size={11} />
              </button>
              {pickerOpen ? (
                <div className="sm-message-picker-menu">
                  {recipients.map((recipient) => {
                    const selected = recipientIds.includes(recipient.id);
                    return <button type="button" key={recipient.id} onClick={() => toggleRecipient(recipient.id)}><span><strong>{recipient.name}</strong><small>{recipient.email}</small></span><i className={selected ? "selected" : ""}>{selected ? <Check size={10} /> : null}</i></button>;
                  })}
                </div>
              ) : null}
            </div>
          </div>
          <div className="sm-message-mode-row">
            {([[
              "all", "Alle SM",
            ], ["individual", "Einzelne auswählen"]] as const).map(([value, label]) => (
              <button type="button" key={value} onClick={() => changeMode(value)} className={mode === value ? "is-active" : ""}><i>{mode === value ? <span /> : null}</i>{label}</button>
            ))}
          </div>
          <div className="sm-message-retention">
            <div className="sm-message-retention-head">
              <span><strong>Nach dem Lesen</strong><small>{keepVisibleAfterRead ? visibilityLabel(visibleAfterReadDays) : "Nach Gelesen ausblenden"}</small></span>
              <button type="button" role="switch" aria-checked={keepVisibleAfterRead} className={keepVisibleAfterRead ? "is-on" : ""} onClick={() => setKeepVisibleAfterRead((current) => !current)}><i /></button>
            </div>
            {keepVisibleAfterRead ? (
              <div className="sm-message-retention-days">
                {[1, 2, 3, 7, 14, 30].map((days) => <button type="button" key={days} className={visibleAfterReadDays === days ? "is-active" : ""} onClick={() => setVisibleAfterReadDays(days)}>{days} T</button>)}
                <label><input type="number" min={1} max={3650} value={visibleAfterReadDays} onChange={(event) => setVisibleAfterReadDays(Math.max(1, Math.min(3650, Number(event.target.value) || 1)))} /><span>Tage</span></label>
              </div>
            ) : null}
          </div>
          <button type="button" className="sm-message-send-button" disabled={!canSend} onClick={() => void submit()}><Send size={12} /> {sending ? "Wird gesendet…" : "Nachricht senden"}</button>
      </div>
    </section>
  );
}

export function SmNachrichtenWorkspace() {
  const [messages, setMessages] = useState<MessageCampaign[]>([]);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [selectedRecipientId, setSelectedRecipientId] = useState<string | null>(null);
  const [messageSearch, setMessageSearch] = useState("");
  const [messageFilter, setMessageFilter] = useState<MessageFilter>("all");
  const [messageSort, setMessageSort] = useState<MessageSort>("newest");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const deferredSearch = useDeferredValue(messageSearch);

  const loadMessages = async (preferredMessageId?: string) => {
    const payload = await fetchAdminSmMessages();
    setMessages(payload.messages);
    setRecipients(payload.recipients);
    const nextSelected = payload.messages.find((message) => message.id === preferredMessageId)
      ?? payload.messages.find((message) => message.id === selectedMessageId)
      ?? payload.messages[0]
      ?? null;
    setSelectedMessageId(nextSelected?.id ?? null);
    setSelectedRecipientId((current) => current && nextSelected?.recipients.some((recipient) => recipient.recipientId === current)
      ? current
      : nextSelected?.recipients[0]?.recipientId ?? null);
  };

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchAdminSmMessages()
      .then((payload) => {
        if (!active) return;
        setMessages(payload.messages);
        setRecipients(payload.recipients);
        setSelectedMessageId(payload.messages[0]?.id ?? null);
        setSelectedRecipientId(payload.messages[0]?.recipients[0]?.recipientId ?? null);
        setError(null);
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "Nachrichten konnten nicht geladen werden.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const filteredMessages = useMemo(() => {
    const query = normalize(deferredSearch);
    const filtered = messages.filter((message) => {
      const count = readCount(message);
      if (messageFilter === "complete" && count !== message.recipients.length) return false;
      if (messageFilter === "open" && count === message.recipients.length) return false;
      if (query && !normalize(`${message.subject} ${message.sender} ${message.body}`).includes(query)) return false;
      return true;
    });
    return messageSort === "oldest" ? filtered.reverse() : filtered;
  }, [deferredSearch, messageFilter, messageSort, messages]);

  const selectedMessage = messages.find((message) => message.id === selectedMessageId) ?? messages[0] ?? null;
  const selectedRecipientState = selectedMessage && selectedRecipientId ? readState(selectedMessage, selectedRecipientId) : null;

  const selectMessage = (message: MessageCampaign) => {
    setSelectedMessageId(message.id);
    setSelectedRecipientId(message.recipients[0]?.recipientId ?? null);
  };

  const composeForRecipient = (recipientId: string) => {
    setSelectedRecipientId(recipientId);
    window.dispatchEvent(new CustomEvent("sm-nachrichten:openComposer", { detail: { recipientId } }));
  };

  const handleSend = async (subject: string, body: string, recipientIds: string[], idempotencyKey: string, visibleAfterReadDays: number) => {
    setError(null);
    setNotice(null);
    try {
      const result = await sendAdminSmMessage({
        subject: subject.trim(),
        body: body.trim(),
        recipientIds,
        idempotencyKey,
        visibleAfterReadDays,
      });
      try {
        await loadMessages(result.messageId);
        setNotice(result.replayed ? "Die Nachricht war bereits gespeichert." : "Nachricht wurde zugestellt.");
      } catch (refreshError) {
        setError(refreshError instanceof Error ? `Nachricht wurde zugestellt, aber die Ansicht konnte nicht aktualisiert werden: ${refreshError.message}` : "Nachricht wurde zugestellt, aber die Ansicht konnte nicht aktualisiert werden.");
      }
    } catch (sendError) {
      const message = sendError instanceof Error ? sendError.message : "Nachricht konnte nicht gesendet werden.";
      setError(message);
      throw sendError;
    }
  };

  const resendSelectedMessage = async () => {
    if (!selectedMessage) return;
    const recipientIds = selectedMessage.recipients.map((recipient) => recipient.recipientId);
    if (recipientIds.length === 0) return;
    await handleSend(
      selectedMessage.subject,
      selectedMessage.body,
      recipientIds,
      crypto.randomUUID(),
      selectedMessage.visibleAfterReadDays ?? 7,
    );
  };

  return (
    <div className="sm-message-page">
      <style>{`
        .sm-message-page { --sm-border: rgba(0,0,0,.075); --sm-muted: rgba(0,0,0,.38); min-width:940px; padding:2px 12px 0 7px; box-sizing:border-box; }
        .sm-message-shell { width:100%; min-height:min(720px,calc(100dvh - 112px)); height:calc(100dvh - 180px); max-height:844px; padding:10px; display:grid; grid-template-columns:minmax(210px,1.06fr) minmax(430px,1.93fr) minmax(250px,1fr); gap:11px; border:1px solid rgba(0,0,0,.07); border-radius:14px; background:rgba(0,0,0,.025); box-sizing:border-box; animation:smMessageIn .24s ease both; }
        .sm-message-list-panel,.sm-message-detail-panel,.sm-message-side-panel { min-width:0; min-height:0; overflow:hidden; border:1px solid var(--sm-border); border-radius:11px; background:#fff; box-shadow:0 1px 6px rgba(0,0,0,.04); }
        .sm-message-list-panel { display:flex; flex-direction:column; }
        .sm-message-detail-panel { display:flex; flex-direction:column; }
        .sm-message-side-panel { container-name:sm-message-side; container-type:size; display:flex; flex-direction:column; overflow:hidden; }
        .sm-message-table-body::-webkit-scrollbar { display:none; }
        .sm-message-panel-heading { height:43px; padding:0 17px; display:flex; align-items:center; border-bottom:1px solid rgba(0,0,0,.05); }
        .sm-message-section-label { color:rgba(0,0,0,.34); font-size:8px; font-weight:750; letter-spacing:.085em; text-transform:uppercase; }
        .sm-message-list-tools { padding:9px 16px 16px; display:flex; flex-direction:column; gap:9px; border-bottom:1px solid rgba(0,0,0,.05); }
        .sm-message-search { height:31px; padding:0 10px; display:flex; align-items:center; gap:6px; border-radius:7px; background:rgba(0,0,0,.026); color:rgba(0,0,0,.28); box-shadow:inset 0 0 0 1px rgba(0,0,0,.06); }
        .sm-message-search input { min-width:0; flex:1; border:0; outline:0; background:transparent; color:#1a1a1a; font-family:inherit; font-size:10.5px; font-weight:500; }
        .sm-message-search button { padding:0; border:0; background:transparent; color:rgba(0,0,0,.3); cursor:pointer; }
        .sm-message-list-filter-row { display:grid; grid-template-columns:1fr 1fr; gap:6px; }
        .sm-message-select { position:relative; width:100%; height:29px; padding:0 10px; display:flex; align-items:center; justify-content:space-between; border:0; border-radius:7px; background:linear-gradient(to bottom,#fff,#f5f5f5); color:rgba(0,0,0,.62); box-shadow:inset 0 1px .6px rgba(255,255,255,.9),inset 0 -1px 0 rgba(0,0,0,.04),0 0 0 1px rgba(0,0,0,.1),0 1px 4px rgba(0,0,0,.07); font-family:inherit; font-size:9px; font-weight:600; cursor:pointer; transition:box-shadow .15s ease,opacity .15s ease; }
        .sm-message-select:hover,.sm-message-select.is-open { box-shadow:inset 0 1px .6px rgba(255,255,255,.9),inset 0 -1px 0 rgba(0,0,0,.04),0 0 0 1px rgba(0,0,0,.15),0 3px 9px rgba(0,0,0,.08); }
        .sm-message-select svg { flex:none; transition:transform .16s ease; }.sm-message-select svg.is-open { transform:rotate(180deg); }
        .sm-message-select-menu { position:fixed; z-index:10000; padding:4px; border:1px solid rgba(0,0,0,.09); border-radius:9px; background:#fff; box-shadow:0 12px 28px rgba(0,0,0,.13); }
        .sm-message-select-menu button { width:100%; min-height:29px; padding:6px 9px; display:flex; align-items:center; justify-content:space-between; gap:10px; border:0; border-radius:6px; background:transparent; color:rgba(0,0,0,.62); text-align:left; font-family:inherit; font-size:9.5px; font-weight:600; cursor:pointer; }
        .sm-message-select-menu button:hover { background:rgba(0,0,0,.035); color:#1a1a1a; }.sm-message-select-menu button.is-selected { background:rgba(220,38,38,.055); color:${RED}; }.sm-message-select-menu button span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .sm-message-list-scroll { min-height:0; flex:1; overflow-y:auto; scrollbar-width:none; }
        .sm-message-list-scroll::-webkit-scrollbar { display:none; }
        .sm-message-list-row { position:relative; width:100%; min-height:112px; padding:15px 16px 13px; display:flex; flex-direction:column; align-items:flex-start; border:0; border-bottom:1px solid rgba(0,0,0,.055); background:#fff; text-align:left; font-family:inherit; cursor:pointer; transition:background .12s ease; }
        .sm-message-list-row:hover { background:rgba(0,0,0,.018); }
        .sm-message-list-row.is-active { background:rgba(220,38,38,.045); }
        .sm-message-list-row.is-active::before { content:""; position:absolute; inset:0 auto 0 0; width:2px; background:${RED}; }
        .sm-message-list-subject { max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:#202124; font-size:11px; font-weight:700; }
        .sm-message-list-meta { margin-top:5px; display:flex; align-items:center; gap:5px; color:rgba(0,0,0,.36); font-size:8.5px; font-weight:500; }
        .sm-message-list-meta i { width:2px; height:2px; border-radius:50%; background:rgba(0,0,0,.2); }
        .sm-message-list-ratio { margin-top:auto; color:rgba(0,0,0,.52); font-size:9px; font-weight:600; }
        .sm-message-progress { width:100%; height:2px; margin-top:8px; overflow:hidden; border-radius:99px; background:rgba(0,0,0,.09); }
        .sm-message-progress span { display:block; height:100%; border-radius:inherit; background:#20b15a; }
        .sm-message-detail-header { min-height:77px; padding:16px 19px 14px; display:flex; align-items:flex-start; justify-content:space-between; gap:14px; border-bottom:1px solid rgba(0,0,0,.055); }
        .sm-message-detail-header h2 { margin:0; color:#1a1a1a; font-size:14px; font-weight:750; letter-spacing:-.015em; }
        .sm-message-detail-meta { margin-top:8px; display:flex; align-items:center; gap:8px; color:rgba(0,0,0,.4); font-size:9px; }
        .sm-message-sent-badge { padding:3px 8px; border-radius:99px; background:rgba(22,163,74,.08); color:#15803d; font-size:8.5px; font-weight:700; }
        .sm-message-icon-button { width:26px; height:26px; padding:0; display:inline-flex; align-items:center; justify-content:center; flex-shrink:0; border:0; border-radius:7px; background:linear-gradient(to bottom,#fff,#f5f5f5); color:rgba(0,0,0,.52); box-shadow:inset 0 1px .6px rgba(255,255,255,.9),inset 0 -1px 0 rgba(0,0,0,.04),0 0 0 1px rgba(0,0,0,.1),0 1px 4px rgba(0,0,0,.07); cursor:pointer; transition:opacity .15s ease; }
        .sm-message-icon-button:hover,.sm-message-icon-button.is-open { opacity:.82; }
        .sm-message-recipient-menu { position:fixed; z-index:10000; padding:4px; border:1px solid rgba(0,0,0,.09); border-radius:9px; background:#fff; box-shadow:0 12px 28px rgba(0,0,0,.13); }
        .sm-message-recipient-menu button { width:100%; min-height:29px; padding:6px 9px; border:0; border-radius:6px; background:transparent; color:rgba(0,0,0,.62); text-align:left; font-family:inherit; font-size:9.5px; font-weight:600; cursor:pointer; }.sm-message-recipient-menu button:hover { background:rgba(0,0,0,.04); color:#1a1a1a; }
        .sm-message-content { margin:15px 19px; padding:16px; min-height:227px; border:1px solid rgba(0,0,0,.065); border-radius:9px; background:#fff; color:#34383d; font-size:10.5px; line-height:1.62; white-space:pre-line; box-shadow:0 1px 4px rgba(0,0,0,.025); }
        .sm-message-content-recipient { margin:-16px -16px 14px; padding:10px 12px; display:flex; align-items:center; justify-content:space-between; gap:12px; border-bottom:1px solid rgba(0,0,0,.055); background:rgba(0,0,0,.012); white-space:normal; }
        .sm-message-content-person { min-width:0; display:flex; align-items:center; gap:8px; }.sm-message-content-person > span { width:25px; height:25px; display:inline-flex; align-items:center; justify-content:center; flex:none; border-radius:50%; background:rgba(0,0,0,.05); color:rgba(0,0,0,.58); font-size:8px; font-weight:750; }.sm-message-content-person > div { min-width:0; display:flex; flex-direction:column; }.sm-message-content-person strong { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:#30343a; font-size:9.5px; line-height:1.3; }.sm-message-content-person small { color:rgba(0,0,0,.36); font-size:8px; line-height:1.4; }
        .sm-message-content-state { display:flex; align-items:center; gap:7px; white-space:nowrap; }.sm-message-content-state > small { color:rgba(0,0,0,.36); font-size:8px; }.sm-message-content-body { white-space:pre-line; }
        .sm-message-recipients { min-height:0; flex:1; display:flex; flex-direction:column; border-top:1px solid rgba(0,0,0,.055); }
        .sm-message-recipients-toolbar { min-height:54px; padding:10px 18px; display:flex; align-items:center; justify-content:space-between; gap:12px; border-bottom:1px solid rgba(0,0,0,.05); }
        .sm-message-recipient-filters { display:flex; gap:4px; }
        .sm-message-filter { height:26px; padding:0 10px; border:0; border-radius:6px; background:linear-gradient(to bottom,#fff,#f5f5f5); color:rgba(0,0,0,.48); box-shadow:inset 0 1px .6px rgba(255,255,255,.9),inset 0 -1px 0 rgba(0,0,0,.04),0 0 0 1px rgba(0,0,0,.09),0 1px 3px rgba(0,0,0,.05); font-family:inherit; font-size:9px; font-weight:600; cursor:pointer; transition:opacity .15s ease; }
        .sm-message-filter:hover { opacity:.82; }
        .sm-message-filter.is-active { background:linear-gradient(to bottom,#fff,#f7f7f7); color:#1a1a1a; box-shadow:inset 0 1px .6px rgba(255,255,255,.9),0 0 0 1px rgba(0,0,0,.16),0 1px 4px rgba(0,0,0,.07); }
        .sm-message-recipient-search { width:190px; }
        .sm-message-table-header,.sm-message-table-row { display:grid; grid-template-columns:minmax(150px,1.4fr) 58px 86px 82px minmax(108px,1fr) 27px; column-gap:10px; align-items:center; }
        .sm-message-table-header { min-height:29px; padding:0 18px; border-bottom:1px solid rgba(0,0,0,.05); background:rgba(0,0,0,.014); }
        .sm-message-table-header span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:rgba(0,0,0,.29); font-size:7.5px; font-weight:750; letter-spacing:.07em; text-transform:uppercase; }
        .sm-message-table-body { min-height:0; overflow-y:auto; scrollbar-width:none; }
        .sm-message-table-row { position:relative; min-height:44px; padding:0 18px; border-bottom:1px solid rgba(0,0,0,.045); outline:0; color:rgba(0,0,0,.52); font-size:9px; cursor:pointer; transition:background .1s ease; }
        .sm-message-table-row > span { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .sm-message-table-row:hover { background:rgba(0,0,0,.022); }.sm-message-table-row:focus-visible { box-shadow:inset 0 0 0 2px rgba(220,38,38,.18); }.sm-message-table-row.is-selected { background:rgba(220,38,38,.04); }.sm-message-table-row.is-selected::before { content:""; position:absolute; inset:0 auto 0 0; width:2px; background:${RED}; }
        .sm-message-person { min-width:0; display:flex; align-items:center; gap:8px; }
        .sm-message-person > span { width:23px; height:23px; display:inline-flex; align-items:center; justify-content:center; flex-shrink:0; border-radius:50%; background:rgba(0,0,0,.045); color:rgba(0,0,0,.55); font-size:8px; font-weight:750; }
        .sm-message-person strong { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:#374151; font-size:9.5px; font-weight:650; }
        .sm-message-delivered { display:flex; align-items:center; gap:3px; color:rgba(0,0,0,.46); }
        .sm-message-date { font-variant-numeric:tabular-nums; }
        .sm-message-badge { display:inline-flex; padding:3px 7px; border-radius:99px; font-size:8px; font-weight:700; white-space:nowrap; }
        .sm-message-badge-read { background:rgba(22,163,74,.08); color:#15803d; }
        .sm-message-badge-unread { background:rgba(217,119,6,.09); color:#b45309; }
        .sm-message-empty { padding:38px 20px; color:rgba(0,0,0,.35); font-size:10px; text-align:center; }
        .sm-message-summary-card,.sm-message-parallel-card,.sm-message-compose { padding:16px 17px; border-bottom:1px solid rgba(0,0,0,.065); background:#fff; box-sizing:border-box; }
        .sm-message-summary-card,.sm-message-parallel-card { height:auto; flex:none; }
        .sm-message-summary-main { margin-top:17px; display:flex; align-items:center; gap:19px; }
        .sm-message-ring { width:98px; height:98px; padding:7px; flex-shrink:0; border-radius:50%; background:conic-gradient(#22a958 var(--read-progress),rgba(0,0,0,.075) 0); }
        .sm-message-ring > div { width:100%; height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; border-radius:50%; background:#fff; }
        .sm-message-ring strong { color:#30343a; font-size:10px; font-weight:750; }
        .sm-message-ring span { margin-top:3px; color:rgba(0,0,0,.35); font-size:8.5px; }
        .sm-message-summary-values { min-width:0; display:flex; flex-direction:column; gap:10px; }
        .sm-message-summary-values span { display:grid; grid-template-columns:7px 24px 1fr; align-items:center; gap:5px; color:rgba(0,0,0,.43); font-size:9px; }
        .sm-message-summary-values i { width:5px; height:5px; border-radius:50%; background:rgba(0,0,0,.2); }
        .sm-message-summary-values i.green { background:#20b15a; }.sm-message-summary-values i.amber { background:#d97706; }
        .sm-message-summary-values strong { color:#272b31; font-size:12px; font-weight:750; }
        .sm-message-visibility-summary { margin-top:13px; padding:7px 9px; border:1px solid rgba(0,0,0,.055); border-radius:7px; background:rgba(0,0,0,.018); color:rgba(0,0,0,.48); font-size:8.5px; font-weight:600; text-align:center; }
        .sm-message-summary-actions { margin-top:17px; display:grid; grid-template-columns:1fr 31px; gap:7px; }
        .sm-message-summary-actions button { height:30px; display:flex; align-items:center; justify-content:center; gap:6px; border:0; border-radius:7px; background:linear-gradient(to bottom,#fff,#f5f5f5); color:rgba(0,0,0,.62); box-shadow:inset 0 1px .6px rgba(255,255,255,.9),inset 0 -1px 0 rgba(0,0,0,.04),0 0 0 1px rgba(0,0,0,.1),0 1px 4px rgba(0,0,0,.07); font-family:inherit; font-size:9px; font-weight:600; cursor:pointer; transition:opacity .15s ease; }
        .sm-message-summary-actions button:hover { opacity:.82; }
        .sm-message-parallel-card p { margin:9px 0 13px; color:rgba(0,0,0,.38); font-size:8.5px; }
        .sm-message-parallel-item { padding:12px; border:1px solid rgba(0,0,0,.06); border-radius:8px; background:#fff; }
        .sm-message-parallel-item + .sm-message-parallel-item { margin-top:7px; }
        .sm-message-parallel-title { display:flex; align-items:flex-start; justify-content:space-between; gap:8px; }
        .sm-message-parallel-title strong { color:#34383d; font-size:9.5px; line-height:1.35; }
        .sm-message-parallel-item > span { display:block; margin-top:7px; color:rgba(0,0,0,.38); font-size:8px; }
        .sm-message-compose { min-height:0; flex:1 1 0; padding:0; display:flex; flex-direction:column; border-bottom:0; }
        .sm-message-compose-heading { width:100%; height:43px; padding:0 16px; flex:none; display:flex; align-items:center; border:0; background:#fff; color:rgba(0,0,0,.4); }
        .sm-message-compose-body { min-height:0; margin-top:-7px; padding:0 16px 15px; flex:1; display:flex; flex-direction:column; }
        .sm-message-compose-body label,.sm-message-compose-field { flex:none; display:block; margin-top:10px; }
        .sm-message-compose-body > label:nth-of-type(2) { min-height:58px; flex:1; display:flex; flex-direction:column; }
        .sm-message-compose-body label > span,.sm-message-compose-field > span { display:block; margin-bottom:5px; color:rgba(0,0,0,.52); font-size:8.5px; font-weight:650; }
        .sm-message-compose-body input,.sm-message-compose-body textarea { width:100%; border:1px solid rgba(0,0,0,.09); border-radius:7px; outline:0; background:#fff; color:#34383d; font-family:inherit; font-size:9.5px; font-weight:500; line-height:1.5; box-shadow:inset 0 1px 2px rgba(0,0,0,.02); }
        .sm-message-compose-body input::placeholder,.sm-message-compose-body textarea::placeholder { color:rgba(0,0,0,.24); font-weight:400; opacity:1; }
        .sm-message-compose-body input { height:30px; padding:0 9px; }.sm-message-compose-body textarea { min-height:48px; padding:8px 9px; flex:1; resize:none; }
        .sm-message-compose-body input:focus,.sm-message-compose-body textarea:focus { border-color:rgba(220,38,38,.3); box-shadow:0 0 0 2px rgba(220,38,38,.06); }
        .sm-message-recipient-picker { position:relative; }
        .sm-message-recipient-trigger { width:100%; min-height:31px; padding:4px 7px; display:flex; align-items:center; justify-content:space-between; gap:6px; border:1px solid rgba(0,0,0,.09); border-radius:7px; background:#fff; color:rgba(0,0,0,.35); cursor:pointer; }
        .sm-message-selected-recipients { min-width:0; display:flex; align-items:center; gap:4px; overflow:hidden; }
        .sm-message-selected-recipients i { padding:3px 6px; border-radius:5px; background:rgba(0,0,0,.035); color:rgba(0,0,0,.55); font-size:7.5px; font-style:normal; white-space:nowrap; }
        .sm-message-selected-recipients em { color:rgba(0,0,0,.3); font-size:9px; font-style:normal; }
        .sm-message-picker-menu { position:absolute; z-index:30; right:0; bottom:calc(100% + 5px); left:0; max-height:196px; padding:5px; overflow-y:auto; border:1px solid rgba(0,0,0,.08); border-radius:9px; background:#fff; box-shadow:0 14px 36px rgba(0,0,0,.12); scrollbar-width:none; }
        .sm-message-picker-menu::-webkit-scrollbar { display:none; }
        .sm-message-picker-menu button { width:100%; min-height:31px; padding:5px 7px; display:flex; align-items:center; justify-content:space-between; border:0; border-radius:6px; background:#fff; text-align:left; cursor:pointer; }
        .sm-message-picker-menu button:hover { background:rgba(0,0,0,.025); }
        .sm-message-picker-menu button > span { display:flex; flex-direction:column; gap:2px; }.sm-message-picker-menu strong { color:#30343a; font-size:9px; }.sm-message-picker-menu small { color:rgba(0,0,0,.35); font-size:7.5px; }
        .sm-message-picker-menu button > i { width:16px; height:16px; display:flex; align-items:center; justify-content:center; border-radius:5px; background:rgba(0,0,0,.04); color:#fff; }.sm-message-picker-menu button > i.selected { background:${RED}; }
        .sm-message-mode-row { margin-top:12px; flex:none; display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
        .sm-message-mode-row button { padding:0; display:flex; align-items:center; gap:5px; border:0; background:transparent; color:rgba(0,0,0,.48); font-family:inherit; font-size:8px; font-weight:550; cursor:pointer; }
        .sm-message-mode-row button > i { width:13px; height:13px; display:flex; align-items:center; justify-content:center; border:1px solid rgba(0,0,0,.15); border-radius:50%; }.sm-message-mode-row button.is-active > i { border-color:rgba(220,38,38,.34); }.sm-message-mode-row button > i span { width:6px; height:6px; border-radius:50%; background:${RED}; }
        .sm-message-retention { margin-top:10px; padding:8px 9px; flex:none; border:1px solid rgba(0,0,0,.065); border-radius:8px; background:rgba(0,0,0,.014); }
        .sm-message-retention-head { display:flex; align-items:center; justify-content:space-between; gap:10px; }
        .sm-message-retention-head > span { min-width:0; display:flex; flex-direction:column; gap:2px; }.sm-message-retention-head strong { color:#34383d; font-size:8.5px; font-weight:700; }.sm-message-retention-head small { color:rgba(0,0,0,.38); font-size:7.5px; }
        .sm-message-retention-head > button { position:relative; width:29px; height:17px; padding:0; flex:none; border:0; border-radius:99px; background:rgba(0,0,0,.12); cursor:pointer; transition:background .16s ease; }.sm-message-retention-head > button.is-on { background:${RED}; }.sm-message-retention-head > button i { position:absolute; top:2px; left:2px; width:13px; height:13px; border-radius:50%; background:#fff; box-shadow:0 1px 3px rgba(0,0,0,.18); transition:left .16s ease; }.sm-message-retention-head > button.is-on i { left:14px; }
        .sm-message-retention-days { margin-top:7px; display:flex; align-items:center; gap:4px; }.sm-message-retention-days > button { height:22px; min-width:25px; padding:0 5px; border:1px solid rgba(0,0,0,.07); border-radius:6px; background:#fff; color:rgba(0,0,0,.45); font-family:inherit; font-size:7.5px; font-weight:650; cursor:pointer; }.sm-message-retention-days > button.is-active { border-color:rgba(220,38,38,.18); background:rgba(220,38,38,.055); color:${RED}; }.sm-message-retention-days label { min-width:0; height:22px; margin:0 0 0 auto!important; display:flex!important; align-items:center; border:1px solid rgba(0,0,0,.07); border-radius:6px; background:#fff; overflow:hidden; }.sm-message-retention-days label input { width:35px!important; height:20px!important; padding:0 4px!important; border:0!important; border-radius:0!important; text-align:right; font-size:7.5px!important; box-shadow:none!important; }.sm-message-retention-days label span { margin:0!important; padding-right:5px; color:rgba(0,0,0,.35)!important; font-size:7px!important; }
        .sm-message-send-button { width:100%; height:34px; margin-top:10px; flex:none; display:flex; align-items:center; justify-content:center; gap:6px; border:0; border-radius:7px; background:linear-gradient(to bottom,#DC2626,#b91c1c); color:#fff; box-shadow:inset 0 1px .6px rgba(255,255,255,.33),inset 0 -1px 0 rgba(255,255,255,.15),0 0 0 1px #a91b1b,0 1px 6px rgba(180,20,20,.14); font-family:inherit; font-size:9.5px; font-weight:650; cursor:pointer; transition:opacity .15s ease; }
        .sm-message-send-button:not(:disabled):hover { opacity:.9; }
        .sm-message-send-button:disabled { opacity:.45; cursor:not-allowed; }
        button:focus-visible { outline:2px solid rgba(220,38,38,.25); outline-offset:2px; }
        @container sm-message-side (max-height:720px) {
          .sm-message-summary-card,.sm-message-parallel-card { padding:13px 15px; }
          .sm-message-summary-main { margin-top:12px; gap:15px; }
          .sm-message-ring { width:84px; height:84px; }
          .sm-message-summary-values { gap:8px; }
          .sm-message-summary-actions { margin-top:12px; }
          .sm-message-parallel-card p { margin:7px 0 10px; }
          .sm-message-parallel-item { padding:10px; }
          .sm-message-parallel-item > span { margin-top:5px; }
          .sm-message-compose-heading { height:39px; }
          .sm-message-compose-body { margin-top:-6px; padding:0 14px 12px; }
          .sm-message-compose-body label,.sm-message-compose-field { margin-top:8px; }
          .sm-message-compose-body textarea { min-height:44px; }
          .sm-message-mode-row { margin-top:9px; }
          .sm-message-send-button { margin-top:8px; }
        }
        @container sm-message-side (max-height:620px) {
          .sm-message-summary-card,.sm-message-parallel-card { padding:10px 13px; }
          .sm-message-summary-main { margin-top:8px; gap:12px; }
          .sm-message-ring { width:72px; height:72px; padding:5px; }
          .sm-message-summary-values { gap:6px; }
          .sm-message-summary-actions { margin-top:8px; }
          .sm-message-summary-actions button { height:28px; }
          .sm-message-parallel-card p { margin:5px 0 8px; }
          .sm-message-parallel-item { padding:8px 10px; }
          .sm-message-parallel-item > span { margin-top:4px; }
          .sm-message-parallel-item .sm-message-progress { margin-top:6px; }
          .sm-message-compose-heading { height:34px; }
          .sm-message-compose-body { margin-top:-5px; padding:0 12px 10px; }
          .sm-message-compose-body label,.sm-message-compose-field { margin-top:6px; }
          .sm-message-compose-body label > span,.sm-message-compose-field > span { margin-bottom:4px; }
          .sm-message-compose-body input { height:27px; }
          .sm-message-compose-body > label:nth-of-type(2) { min-height:44px; }
          .sm-message-compose-body textarea { min-height:36px; padding-top:6px; padding-bottom:6px; }
          .sm-message-recipient-trigger { min-height:28px; }
          .sm-message-mode-row { margin-top:8px; }
          .sm-message-send-button { height:30px; margin-top:6px; }
        }
        @keyframes smMessageIn { from { opacity:0; transform:translateY(7px); } to { opacity:1; transform:translateY(0); } }
      `}</style>

      {error ? <div role="alert" style={{ margin: "0 12px 8px 7px", padding: "8px 11px", border: "1px solid rgba(220,38,38,.16)", borderRadius: 8, background: "rgba(254,242,242,.96)", color: "#B91C1C", fontSize: 10, fontWeight: 600 }}>{error}</div> : null}
      {notice ? <div role="status" style={{ margin: "0 12px 8px 7px", padding: "8px 11px", border: "1px solid rgba(22,163,74,.16)", borderRadius: 8, background: "rgba(240,253,244,.96)", color: "#15803D", fontSize: 10, fontWeight: 600 }}>{notice}</div> : null}

      <div className="sm-message-shell">
        <aside className="sm-message-list-panel">
          <div className="sm-message-panel-heading"><SectionLabel>Nachrichten</SectionLabel></div>
          <div className="sm-message-list-tools">
            <label className="sm-message-search"><Search size={11} strokeWidth={2} /><input value={messageSearch} onChange={(event) => setMessageSearch(event.target.value)} placeholder="Nachrichten suchen…" />{messageSearch ? <button type="button" onClick={() => setMessageSearch("")}><X size={10} /></button> : null}</label>
            <div className="sm-message-list-filter-row">
              <MessageSelectDropdown<MessageFilter> value={messageFilter} options={MESSAGE_FILTER_OPTIONS} onChange={setMessageFilter} />
              <MessageSelectDropdown<MessageSort> value={messageSort} options={MESSAGE_SORT_OPTIONS} onChange={setMessageSort} />
            </div>
          </div>
          <div className="sm-message-list-scroll">
            {filteredMessages.map((message) => <MessageListRow key={message.id} message={message} active={message.id === selectedMessage?.id} onSelect={() => selectMessage(message)} />)}
            {loading ? <div className="sm-message-empty">Nachrichten werden geladen…</div> : null}
            {!loading && filteredMessages.length === 0 ? <div className="sm-message-empty">Noch keine Nachrichten gesendet.</div> : null}
          </div>
        </aside>

        <section className="sm-message-detail-panel">
          {selectedMessage ? (
            <>
              <div className="sm-message-detail-header">
                <div><h2>{selectedRecipientState ? `${selectedMessage.subject} — ${selectedRecipientState.name}` : selectedMessage.subject}</h2><div className="sm-message-detail-meta"><span className="sm-message-sent-badge">Gesendet</span><span>{formatDateTime(selectedMessage.sentAt)}</span><span>·</span><span>Von {selectedMessage.sender}</span></div></div>
                <button type="button" className="sm-message-icon-button" aria-label="Nachrichtenaktionen"><MoreHorizontal size={13} /></button>
              </div>
              <div className="sm-message-content">
                {selectedRecipientState ? (
                  <div className="sm-message-content-recipient">
                    <div className="sm-message-content-person"><span>{initials(selectedRecipientState.name)}</span><div><strong>{selectedRecipientState.name}</strong><small>{selectedRecipientState.email}</small></div></div>
                    <div className="sm-message-content-state"><StatusBadge read={Boolean(selectedRecipientState.readAt)} /><small>{selectedRecipientState.readAt ? formatDateTime(selectedRecipientState.readAt) : "Noch nicht gelesen"}</small></div>
                  </div>
                ) : null}
                <div className="sm-message-content-body">{selectedMessage.body}</div>
              </div>
              <div className="sm-message-panel-heading"><SectionLabel>Empfänger & Lesestatus</SectionLabel></div>
              <RecipientTable
                key={selectedMessage.id}
                message={selectedMessage}
                selectedRecipientId={selectedRecipientId}
                onSelectRecipient={setSelectedRecipientId}
                onComposeRecipient={composeForRecipient}
              />
            </>
          ) : <div className="sm-message-empty" style={{ margin: "auto" }}>Sende die erste Nachricht an deine SMs.</div>}
        </section>

        <aside className="sm-message-side-panel">
          {selectedMessage ? <ReadSummary message={selectedMessage} messages={messages} selectedRecipientId={selectedRecipientId} onResend={() => { void resendSelectedMessage(); }} /> : null}
          <Composer recipients={recipients} onSend={handleSend} />
        </aside>
      </div>
    </div>
  );
}
