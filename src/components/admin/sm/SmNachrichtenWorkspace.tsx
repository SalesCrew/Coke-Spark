"use client";

import { memo, useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronUp,
  MoreHorizontal,
  RotateCcw,
  Search,
  Send,
  X,
} from "lucide-react";

const RED = "#DC2626";

type Recipient = {
  id: string;
  name: string;
  initials: string;
  region: string;
};

type MessageRecipient = {
  recipientId: string;
  deliveredAt: string;
  readAt: string | null;
};

type MessageCampaign = {
  id: string;
  subject: string;
  sentAt: string;
  sender: string;
  body: string;
  recipients: MessageRecipient[];
};

type RecipientFilter = "all" | "read" | "unread";
type MessageFilter = "all" | "complete" | "open";

const RECIPIENTS: Recipient[] = [
  { id: "adriana", name: "Adriana Maier", initials: "AM", region: "Ost" },
  { id: "selina", name: "Selina Huber", initials: "SH", region: "Nord" },
  { id: "melanie", name: "Melanie Gruber", initials: "MG", region: "Süd" },
  { id: "lara", name: "Lara König", initials: "LK", region: "West" },
  { id: "tobias", name: "Tobias Steiner", initials: "TS", region: "Ost" },
  { id: "michael", name: "Michael Koller", initials: "MK", region: "Nord" },
  { id: "nina", name: "Nina Bauer", initials: "NB", region: "Süd" },
  { id: "julia", name: "Julia Pichler", initials: "JP", region: "West" },
  { id: "sophie", name: "Sophie Leitner", initials: "SL", region: "Ost" },
  { id: "daniel", name: "Daniel Huber", initials: "DH", region: "Nord" },
  { id: "miriam", name: "Miriam Hofer", initials: "MH", region: "Süd" },
  { id: "elena", name: "Elena Wagner", initials: "EW", region: "West" },
];

const READ_TIMES = ["09:28", "09:31", "09:47", "10:02", "10:18", "10:23", "10:41", "11:04", "11:18", "11:32", "11:51", "12:06"];

function buildRecipients(readCount: number, unreadFirstId?: string): MessageRecipient[] {
  const ordered = unreadFirstId
    ? [...RECIPIENTS.filter((recipient) => recipient.id !== unreadFirstId), RECIPIENTS.find((recipient) => recipient.id === unreadFirstId)!]
    : RECIPIENTS;
  const readIds = new Set(ordered.slice(0, readCount).map((recipient) => recipient.id));
  return RECIPIENTS.map((recipient, index) => ({
    recipientId: recipient.id,
    deliveredAt: "13.08.2026, 09:16",
    readAt: readIds.has(recipient.id) ? `13.08.2026, ${READ_TIMES[index]}` : null,
  }));
}

const INITIAL_MESSAGES: MessageCampaign[] = [
  {
    id: "message-regalplan-33",
    subject: "Neue Regalplan-Vorgabe KW 33",
    sentAt: "13.08.2026, 09:15",
    sender: "Denise Lehner",
    body: "Liebe SMs,\n\nbitte beachtet die aktualisierte Regalplan-Vorgabe für KW 33. Die Anpassungen betreffen die Platzierung unserer Sommeraktionen sowie die Zweitplatzierungen im Getränkeregal.\n\nDie neue Vorgabe ist ab sofort umzusetzen.\n\nDanke für eure Unterstützung!\n\nBeste Grüße\nDenise",
    recipients: buildRecipients(8),
  },
  {
    id: "message-foto-august",
    subject: "Foto-Dokumentation August",
    sentAt: "13.08.2026, 08:30",
    sender: "Denise Lehner",
    body: "Bitte ladet die Dokumentationsfotos im August vollständig und direkt beim jeweiligen Einsatz hoch.",
    recipients: buildRecipients(5, "adriana"),
  },
  {
    id: "message-sommeraktion",
    subject: "Sommeraktion – Platzierung & Zweitplatzierungen",
    sentAt: "11.08.2026, 14:22",
    sender: "Doris SC Coke",
    body: "Für die laufende Sommeraktion bitte alle Haupt- und Zweitplatzierungen nach Vorgabe kontrollieren.",
    recipients: buildRecipients(10),
  },
  {
    id: "message-schulung",
    subject: "Schulung: OOS Optimierung im Regal",
    sentAt: "08.08.2026, 10:05",
    sender: "Denise Lehner",
    body: "Die neue Kurzschulung zur OOS-Behebung ist ab sofort verfügbar. Bitte vor dem nächsten Einsatz ansehen.",
    recipients: buildRecipients(11),
  },
];

const recipientById = new Map(RECIPIENTS.map((recipient) => [recipient.id, recipient]));

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
      <span className="sm-message-list-meta">{message.sentAt} <i /> {message.recipients.length} Empfänger</span>
      <span className="sm-message-list-ratio">{read}/{message.recipients.length} gelesen</span>
      <span className="sm-message-progress"><span style={{ width: `${readPercent(message)}%` }} /></span>
    </button>
  );
});

function FilterButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`sm-message-filter${active ? " is-active" : ""}`}>{label}</button>;
}

function RecipientTable({ message }: { message: MessageCampaign }) {
  const [filter, setFilter] = useState<RecipientFilter>("all");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);

  const rows = useMemo(() => {
    const query = normalize(deferredSearch);
    return message.recipients.filter((state) => {
      const recipient = recipientById.get(state.recipientId);
      if (!recipient) return false;
      if (filter === "read" && !state.readAt) return false;
      if (filter === "unread" && state.readAt) return false;
      if (query && !normalize(`${recipient.name} ${recipient.region}`).includes(query)) return false;
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
        <span>Shelf Merchandiser</span><span>Region</span><span>Zustellung</span><span>Lesestatus</span><span>Gelesen am</span><span />
      </div>
      <div className="sm-message-table-body">
        {rows.map((state) => {
          const recipient = recipientById.get(state.recipientId)!;
          return (
            <div key={state.recipientId} className="sm-message-table-row">
              <div className="sm-message-person"><span>{recipient.initials}</span><strong>{recipient.name}</strong></div>
              <span>{recipient.region}</span>
              <span className="sm-message-delivered"><Check size={10} strokeWidth={2.2} /> Zugestellt</span>
              <span><StatusBadge read={Boolean(state.readAt)} /></span>
              <span className="sm-message-date">{state.readAt ?? "—"}</span>
              <button type="button" aria-label={`Aktionen für ${recipient.name}`} className="sm-message-icon-button"><MoreHorizontal size={13} /></button>
            </div>
          );
        })}
        {rows.length === 0 ? <div className="sm-message-empty">Keine passenden Empfänger gefunden.</div> : null}
      </div>
    </div>
  );
}

function ReadSummary({ message }: { message: MessageCampaign }) {
  const read = readCount(message);
  const total = message.recipients.length;
  const percent = readPercent(message);
  const focusRecipientId = message.recipients[0]?.recipientId;
  const focusRecipient = focusRecipientId ? recipientById.get(focusRecipientId) : null;
  const parallelMessages = focusRecipientId
    ? INITIAL_MESSAGES.filter((candidate) => candidate.id !== message.id && readState(candidate, focusRecipientId)).slice(0, 1)
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
        <div className="sm-message-summary-actions">
          <button type="button"><RotateCcw size={11} /> Erneut senden</button>
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
              <span>Gesendet: {candidate.sentAt}</span>
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
  open,
  onToggle,
  onSend,
}: {
  open: boolean;
  onToggle: () => void;
  onSend: (subject: string, body: string, recipientIds: string[]) => void;
}) {
  const [subject, setSubject] = useState("Neue Aktion: Zweitplatzierung Energy");
  const [body, setBody] = useState("Bitte setzt die neue Zweitplatzierung der Energy-Promotion wie im Anhang beschrieben um.\n\nVielen Dank!");
  const [recipientIds, setRecipientIds] = useState<string[]>(["adriana", "selina", "melanie", "lara", "tobias", "michael", "nina"]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [mode, setMode] = useState<"all" | "region" | "individual">("individual");

  const displayedIds = recipientIds.slice(0, 2);
  const remaining = recipientIds.length - displayedIds.length;
  const canSend = subject.trim().length > 0 && body.trim().length > 0 && recipientIds.length > 0;

  const toggleRecipient = (recipientId: string) => {
    setMode("individual");
    setRecipientIds((current) => current.includes(recipientId) ? current.filter((id) => id !== recipientId) : [...current, recipientId]);
  };

  const changeMode = (nextMode: "all" | "region" | "individual") => {
    setMode(nextMode);
    if (nextMode === "all") setRecipientIds(RECIPIENTS.map((recipient) => recipient.id));
    if (nextMode === "region") setRecipientIds(RECIPIENTS.filter((recipient) => recipient.region === "Ost").map((recipient) => recipient.id));
  };

  return (
    <section className={`sm-message-compose${open ? " is-open" : ""}`}>
      <button type="button" className="sm-message-compose-toggle" onClick={onToggle} aria-expanded={open}>
        <SectionLabel>Neue Nachricht erstellen</SectionLabel>
        {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
      </button>
      {open ? (
        <div className="sm-message-compose-body">
          <label><span>Betreff</span><input value={subject} onChange={(event) => setSubject(event.target.value)} /></label>
          <label><span>Nachricht</span><textarea value={body} onChange={(event) => setBody(event.target.value)} rows={5} /></label>
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
                  {RECIPIENTS.map((recipient) => {
                    const selected = recipientIds.includes(recipient.id);
                    return <button type="button" key={recipient.id} onClick={() => toggleRecipient(recipient.id)}><span><strong>{recipient.name}</strong><small>{recipient.region}</small></span><i className={selected ? "selected" : ""}>{selected ? <Check size={10} /> : null}</i></button>;
                  })}
                </div>
              ) : null}
            </div>
          </div>
          <div className="sm-message-mode-row">
            {([[
              "all", "Alle SM",
            ], ["region", "Region Ost"], ["individual", "Einzelne auswählen"]] as const).map(([value, label]) => (
              <button type="button" key={value} onClick={() => changeMode(value)} className={mode === value ? "is-active" : ""}><i>{mode === value ? <span /> : null}</i>{label}</button>
            ))}
          </div>
          <button type="button" className="sm-message-send-button" disabled={!canSend} onClick={() => { onSend(subject, body, recipientIds); setPickerOpen(false); }}><Send size={12} /> Nachricht senden</button>
        </div>
      ) : null}
    </section>
  );
}

export function SmNachrichtenWorkspace() {
  const [messages, setMessages] = useState<MessageCampaign[]>(INITIAL_MESSAGES);
  const [selectedMessageId, setSelectedMessageId] = useState(INITIAL_MESSAGES[0].id);
  const [messageSearch, setMessageSearch] = useState("");
  const [messageFilter, setMessageFilter] = useState<MessageFilter>("all");
  const [composerOpen, setComposerOpen] = useState(true);
  const deferredSearch = useDeferredValue(messageSearch);

  useEffect(() => {
    const openComposer = () => setComposerOpen(true);
    window.addEventListener("sm-nachrichten:openComposer", openComposer);
    return () => window.removeEventListener("sm-nachrichten:openComposer", openComposer);
  }, []);

  const filteredMessages = useMemo(() => {
    const query = normalize(deferredSearch);
    return messages.filter((message) => {
      const count = readCount(message);
      if (messageFilter === "complete" && count !== message.recipients.length) return false;
      if (messageFilter === "open" && count === message.recipients.length) return false;
      if (query && !normalize(`${message.subject} ${message.sender} ${message.body}`).includes(query)) return false;
      return true;
    });
  }, [deferredSearch, messageFilter, messages]);

  const selectedMessage = messages.find((message) => message.id === selectedMessageId) ?? messages[0];

  const handleSend = (subject: string, body: string, recipientIds: string[]) => {
    const next: MessageCampaign = {
      id: `message-${Date.now()}`,
      subject: subject.trim(),
      body: body.trim(),
      sender: "Dev Account",
      sentAt: "11.08.2026, 14:30",
      recipients: recipientIds.map((recipientId) => ({ recipientId, deliveredAt: "11.08.2026, 14:30", readAt: null })),
    };
    setMessages((current) => [next, ...current]);
    setSelectedMessageId(next.id);
    setComposerOpen(false);
  };

  return (
    <div className="sm-message-page">
      <style>{`
        .sm-message-page { --sm-border: rgba(0,0,0,.075); --sm-muted: rgba(0,0,0,.38); min-width:1030px; padding:2px 12px 0 7px; box-sizing:border-box; }
        .sm-message-shell { width:100%; min-height:720px; height:calc(100vh - 180px); max-height:844px; display:grid; grid-template-columns:minmax(270px,1.06fr) minmax(500px,1.93fr) minmax(286px,1fr); gap:11px; background:transparent; animation:smMessageIn .24s ease both; }
        .sm-message-list-panel,.sm-message-detail-panel,.sm-message-side-panel { min-width:0; min-height:0; overflow:hidden; border:1px solid var(--sm-border); border-radius:11px; background:#fff; box-shadow:0 1px 6px rgba(0,0,0,.04); }
        .sm-message-list-panel { display:flex; flex-direction:column; }
        .sm-message-detail-panel { display:flex; flex-direction:column; }
        .sm-message-side-panel { display:flex; flex-direction:column; overflow:hidden; }
        .sm-message-side-panel::-webkit-scrollbar,.sm-message-table-body::-webkit-scrollbar { display:none; }
        .sm-message-panel-heading { height:43px; padding:0 17px; display:flex; align-items:center; border-bottom:1px solid rgba(0,0,0,.05); }
        .sm-message-section-label { color:rgba(0,0,0,.34); font-size:8px; font-weight:750; letter-spacing:.085em; text-transform:uppercase; }
        .sm-message-list-tools { padding:9px 16px 16px; display:flex; flex-direction:column; gap:9px; border-bottom:1px solid rgba(0,0,0,.05); }
        .sm-message-search { height:31px; padding:0 10px; display:flex; align-items:center; gap:6px; border-radius:7px; background:rgba(0,0,0,.026); color:rgba(0,0,0,.28); box-shadow:inset 0 0 0 1px rgba(0,0,0,.06); }
        .sm-message-search input { min-width:0; flex:1; border:0; outline:0; background:transparent; color:#1a1a1a; font-family:inherit; font-size:10.5px; font-weight:500; }
        .sm-message-search button { padding:0; border:0; background:transparent; color:rgba(0,0,0,.3); cursor:pointer; }
        .sm-message-list-filter-row { display:grid; grid-template-columns:1fr 1fr; gap:6px; }
        .sm-message-select { position:relative; height:29px; padding:0 10px; display:flex; align-items:center; justify-content:space-between; border:0; border-radius:7px; background:linear-gradient(to bottom,#fff,#f5f5f5); color:rgba(0,0,0,.62); box-shadow:inset 0 1px .6px rgba(255,255,255,.9),inset 0 -1px 0 rgba(0,0,0,.04),0 0 0 1px rgba(0,0,0,.1),0 1px 4px rgba(0,0,0,.07); font-family:inherit; font-size:9px; font-weight:600; cursor:pointer; transition:opacity .15s ease; }
        .sm-message-select:hover { opacity:.82; }
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
        .sm-message-icon-button:hover { opacity:.82; }
        .sm-message-content { margin:15px 19px; padding:16px; min-height:227px; border:1px solid rgba(0,0,0,.065); border-radius:9px; background:#fff; color:#34383d; font-size:10.5px; line-height:1.62; white-space:pre-line; box-shadow:0 1px 4px rgba(0,0,0,.025); }
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
        .sm-message-table-row { min-height:44px; padding:0 18px; border-bottom:1px solid rgba(0,0,0,.045); color:rgba(0,0,0,.52); font-size:9px; transition:background .1s ease; }
        .sm-message-table-row:hover { background:rgba(0,0,0,.015); }
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
        .sm-message-summary-card { height:238px; flex:none; }
        .sm-message-parallel-card { height:218px; flex:none; }
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
        .sm-message-summary-actions { margin-top:17px; display:grid; grid-template-columns:1fr 31px; gap:7px; }
        .sm-message-summary-actions button { height:30px; display:flex; align-items:center; justify-content:center; gap:6px; border:0; border-radius:7px; background:linear-gradient(to bottom,#fff,#f5f5f5); color:rgba(0,0,0,.62); box-shadow:inset 0 1px .6px rgba(255,255,255,.9),inset 0 -1px 0 rgba(0,0,0,.04),0 0 0 1px rgba(0,0,0,.1),0 1px 4px rgba(0,0,0,.07); font-family:inherit; font-size:9px; font-weight:600; cursor:pointer; transition:opacity .15s ease; }
        .sm-message-summary-actions button:hover { opacity:.82; }
        .sm-message-parallel-card p { margin:9px 0 13px; color:rgba(0,0,0,.38); font-size:8.5px; }
        .sm-message-parallel-item { padding:12px; border:1px solid rgba(0,0,0,.06); border-radius:8px; background:#fff; }
        .sm-message-parallel-item + .sm-message-parallel-item { margin-top:7px; }
        .sm-message-parallel-title { display:flex; align-items:flex-start; justify-content:space-between; gap:8px; }
        .sm-message-parallel-title strong { color:#34383d; font-size:9.5px; line-height:1.35; }
        .sm-message-parallel-item > span { display:block; margin-top:7px; color:rgba(0,0,0,.38); font-size:8px; }
        .sm-message-compose { min-height:0; flex:1; padding:0; border-bottom:0; }
        .sm-message-compose-toggle { width:100%; height:43px; padding:0 16px; display:flex; align-items:center; justify-content:space-between; border:0; background:#fff; color:rgba(0,0,0,.4); cursor:pointer; }
        .sm-message-compose-body { padding:0 16px 15px; }
        .sm-message-compose-body label,.sm-message-compose-field { display:block; margin-top:10px; }
        .sm-message-compose-body label > span,.sm-message-compose-field > span { display:block; margin-bottom:5px; color:rgba(0,0,0,.52); font-size:8.5px; font-weight:650; }
        .sm-message-compose-body input,.sm-message-compose-body textarea { width:100%; border:1px solid rgba(0,0,0,.09); border-radius:7px; outline:0; background:#fff; color:#34383d; font-family:inherit; font-size:9.5px; font-weight:500; line-height:1.5; box-shadow:inset 0 1px 2px rgba(0,0,0,.02); }
        .sm-message-compose-body input { height:30px; padding:0 9px; }.sm-message-compose-body textarea { padding:8px 9px; resize:none; }
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
        .sm-message-mode-row { margin-top:20px; display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
        .sm-message-mode-row button { padding:0; display:flex; align-items:center; gap:5px; border:0; background:transparent; color:rgba(0,0,0,.48); font-family:inherit; font-size:8px; font-weight:550; cursor:pointer; }
        .sm-message-mode-row button > i { width:13px; height:13px; display:flex; align-items:center; justify-content:center; border:1px solid rgba(0,0,0,.15); border-radius:50%; }.sm-message-mode-row button.is-active > i { border-color:rgba(220,38,38,.34); }.sm-message-mode-row button > i span { width:6px; height:6px; border-radius:50%; background:${RED}; }
        .sm-message-send-button { width:100%; height:34px; margin-top:18px; display:flex; align-items:center; justify-content:center; gap:6px; border:0; border-radius:7px; background:linear-gradient(to bottom,#DC2626,#b91c1c); color:#fff; box-shadow:inset 0 1px .6px rgba(255,255,255,.33),inset 0 -1px 0 rgba(255,255,255,.15),0 0 0 1px #a91b1b,0 1px 6px rgba(180,20,20,.14); font-family:inherit; font-size:9.5px; font-weight:650; cursor:pointer; transition:opacity .15s ease; }
        .sm-message-send-button:not(:disabled):hover { opacity:.9; }
        .sm-message-send-button:disabled { opacity:.45; cursor:not-allowed; }
        button:focus-visible { outline:2px solid rgba(220,38,38,.25); outline-offset:2px; }
        @keyframes smMessageIn { from { opacity:0; transform:translateY(7px); } to { opacity:1; transform:translateY(0); } }
      `}</style>

      <div className="sm-message-shell">
        <aside className="sm-message-list-panel">
          <div className="sm-message-panel-heading"><SectionLabel>Nachrichten</SectionLabel></div>
          <div className="sm-message-list-tools">
            <label className="sm-message-search"><Search size={11} strokeWidth={2} /><input value={messageSearch} onChange={(event) => setMessageSearch(event.target.value)} placeholder="Nachrichten suchen…" />{messageSearch ? <button type="button" onClick={() => setMessageSearch("")}><X size={10} /></button> : null}</label>
            <div className="sm-message-list-filter-row">
              <button type="button" className="sm-message-select" onClick={() => setMessageFilter((current) => current === "all" ? "open" : current === "open" ? "complete" : "all")}><span>{messageFilter === "all" ? "Alle Status" : messageFilter === "open" ? "Mit ungelesenen" : "Vollständig gelesen"}</span><ChevronDown size={10} /></button>
              <button type="button" className="sm-message-select"><span>Neueste zuerst</span><ChevronDown size={10} /></button>
            </div>
          </div>
          <div className="sm-message-list-scroll">
            {filteredMessages.map((message) => <MessageListRow key={message.id} message={message} active={message.id === selectedMessage.id} onSelect={() => setSelectedMessageId(message.id)} />)}
            {filteredMessages.length === 0 ? <div className="sm-message-empty">Keine Nachrichten gefunden.</div> : null}
          </div>
        </aside>

        <section className="sm-message-detail-panel">
          <div className="sm-message-detail-header">
            <div><h2>{selectedMessage.subject}</h2><div className="sm-message-detail-meta"><span className="sm-message-sent-badge">Gesendet</span><span>{selectedMessage.sentAt}</span><span>·</span><span>Von {selectedMessage.sender}</span></div></div>
            <button type="button" className="sm-message-icon-button" aria-label="Nachrichtenaktionen"><MoreHorizontal size={13} /></button>
          </div>
          <div className="sm-message-content">{selectedMessage.body}</div>
          <div className="sm-message-panel-heading"><SectionLabel>Empfänger & Lesestatus</SectionLabel></div>
          <RecipientTable key={selectedMessage.id} message={selectedMessage} />
        </section>

        <aside className="sm-message-side-panel">
          <ReadSummary message={selectedMessage} />
          <Composer open={composerOpen} onToggle={() => setComposerOpen((current) => !current)} onSend={handleSend} />
        </aside>
      </div>
    </div>
  );
}
