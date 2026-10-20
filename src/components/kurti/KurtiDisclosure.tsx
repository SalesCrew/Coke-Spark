"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Info, X } from "lucide-react";

export function KurtiAiLabel() {
  return <span aria-label="KI-Assistent" style={{ display: "inline-flex", alignItems: "center", flexShrink: 0, padding: "2px 4px", border: "1px solid #e2e8f0", borderRadius: 4, background: "#f8fafc", color: "#475569", fontSize: 8, fontWeight: 750, lineHeight: 1 }}>KI</span>;
}

export function KurtiInputNotice({ admin = false }: { admin?: boolean }) {
  return <p data-kurti-ai-notice style={{ position: "relative", zIndex: 2, flexShrink: 0, margin: 0, padding: admin ? "0 1px 7px" : "4px 1px 6px", color: "#475569", fontSize: admin ? 10 : 9.5, lineHeight: 1.45 }}>KI kann Fehler machen. Prüfe wichtige Angaben in Coke Spark.</p>;
}

/** Portal keeps the disclosure outside the chat's clipped/animated panels. */
export function KurtiInformation({ workspace, admin = false }: { workspace: "gm" | "sm"; admin?: boolean }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 12, left: 12, width: 350 });
  const trigger = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const button = trigger.current;
    const place = () => {
      const rect = button?.getBoundingClientRect();
      const width = Math.min(370, window.innerWidth - 24);
      setPosition({ width, left: Math.max(12, Math.min(window.innerWidth - width - 12, (rect?.right ?? width + 12) - width)), top: Math.max(12, Math.min((rect?.bottom ?? 12) + 8, window.innerHeight - Math.min(540, window.innerHeight - 24) - 12)) });
    };
    place();
    const focus = requestAnimationFrame(() => dialog.current?.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true }));
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); event.stopImmediatePropagation(); setOpen(false); }
      if (event.key !== "Tab") return;
      const elements = dialog.current?.querySelectorAll<HTMLElement>('button, a[href]');
      if (!elements?.length) return;
      const first = elements[0], last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", keyboard, true);
    window.addEventListener("resize", place);
    return () => {
      cancelAnimationFrame(focus);
      document.removeEventListener("keydown", keyboard, true);
      window.removeEventListener("resize", place);
      if (button?.isConnected) button.focus({ preventScroll: true });
    };
  }, [open]);

  return <>
    <button ref={trigger} type="button" aria-label="Informationen" title="Informationen zu Kurti" aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? id : undefined}
      onPointerDown={event => event.stopPropagation()} onClick={event => { event.stopPropagation(); setOpen(value => !value); }}
      className="kurti-information-control" style={{ width: admin ? 32 : 26, height: admin ? 32 : 26, flexShrink: 0, border: "1px solid rgba(15,23,42,.09)", borderRadius: admin ? 10 : 9, display: "grid", placeItems: "center", background: "#f8fafc", color: "#475569", cursor: "pointer" }}><Info size={admin ? 15 : 14} /></button>
    {open && createPortal(<div data-kurti-information-overlay onPointerDown={event => { event.stopPropagation(); if (event.target === event.currentTarget) { event.preventDefault(); setOpen(false); } }} onClick={event => event.stopPropagation()}
      style={{ position: "fixed", inset: 0, zIndex: 2147483647, background: "rgba(15,23,42,.12)" }}>
      <div ref={dialog} id={id} role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} className="kurti-information-dialog" style={{ position: "absolute", ...position, maxHeight: "min(540px, calc(100dvh - 24px))", display: "flex", flexDirection: "column", border: "1px solid #e2e8f0", borderRadius: 16, background: "#fff", color: "#334155", boxShadow: "0 16px 60px rgba(15,23,42,.16)", fontFamily: "var(--font-inter), Inter, system-ui, sans-serif", fontSize: 12, lineHeight: 1.6 }}>
        <header style={{ display: "flex", alignItems: "center", gap: 7, padding: "14px 16px 12px", borderBottom: "1px solid #f1f5f9", flexShrink: 0 }}>
          <h2 id={`${id}-title`} style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#0f172a" }}>Über Kurti</h2><KurtiAiLabel />
          <button type="button" aria-label="Informationen schließen" onClick={() => setOpen(false)} style={{ marginLeft: "auto", width: 26, height: 26, display: "grid", placeItems: "center", border: 0, borderRadius: 7, background: "#f8fafc", color: "#475569", cursor: "pointer" }}><X size={15} /></button>
        </header>
        <div style={{ overflowY: "auto", overscrollBehavior: "contain", padding: "2px 16px 14px", scrollbarWidth: "thin", scrollbarColor: "#cbd5e1 transparent" }}>
          <section><h3>KI-Unterstützung</h3><p>Kurti ist ein KI-Assistent, keine live zugeschaltete Person. {admin ? "Er erklärt gespeicherte Daten und Berechnungen und erstellt Tabellen, Diagramme und bestehende Exporte." : "Er hilft bei der Bedienung und erklärt deine eigenen gespeicherten Daten."} Er ändert keine Geschäftsdaten.</p></section>
          <section><h3>Zahlen einordnen</h3><p>Sortierungen vergleichen erfasste Kennzahlen für einen Zeitraum und Filter. Sie belegen allein keine Arbeitsqualität. Kurti beurteilt keine persönlichen Eigenschaften und trifft oder empfiehlt keine Personal- oder Vergütungsentscheidungen. Prüfe wichtige Ergebnisse in den Spark-Ansichten.</p></section>
          <section><h3>Was OpenAI erhält</h3><p>Deine Anfrage, der aktive Verlauf und relevante {admin ? "Ergebnisse freigegebener Datenwerkzeuge" : "eigene App-Daten"} werden an OpenAI gesendet. Bekannte Kontonamen und direkte Kontaktfelder werden ersetzt; Personen erscheinen als Benutzer-IDs. Spark zeigt dazu Namen an. IDs bleiben personenbezogene Daten. Nicht jeder fremde Name im Freitext ist erkennbar: bitte keine privaten oder sensiblen Angaben eingeben.</p><p>{admin ? "Personen wählst du mit @ aus. Nur berechtigte interne Admins erhalten die freigegebenen Lesewerkzeuge des gewählten Bereichs; Kunden haben keinen Zugang." : "Deine Benutzer-ID wird automatisch zugeordnet. Du brauchst kein @ und erhältst nur deine eigenen Daten. Berechtigte interne Admins können aktive Chats für einen konkreten Supportfall lesen."}</p></section>
          <section><h3>Verlauf & Datenschutz</h3><p>Der Verlauf in Spark bleibt {admin ? "8 Stunden" : "15 Minuten"} nach dem letzten erfolgreichen Austausch aktiv. Abgelaufene Nachrichten werden nicht mehr verwendet und beim Lesen oder durch die laufende Bereinigung gelöscht. {admin ? "Mitarbeiter-Chats behalten ihre eigene 15-Minuten-Frist." : "Ein Supportzugriff verlängert die Frist nicht."}</p><p>Die API nutzt <code>store: false</code>. Das bedeutet keine dauerhafte Antwortspeicherung über diese API-Funktion, aber nicht automatisch keine weitere Speicherung bei OpenAI. Maßgeblich sind die vereinbarten Datenkontrollen.</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "5px 14px", marginTop: 9 }}><a href={`/datenschutz/${admin ? "admin" : workspace}`} target="_blank" rel="noopener noreferrer">Datenschutzhinweise</a><a href="https://developers.openai.com/api/docs/guides/your-data" target="_blank" rel="noopener noreferrer">OpenAI-Datenkontrollen</a><a href="mailto:datenschutz@merch.at">datenschutz@merch.at</a></div>
          </section>
        </div>
      </div>
      <style>{`.kurti-information-dialog h3{font-size:11px;font-weight:750;color:#0f172a;margin:13px 0 4px}.kurti-information-dialog p{margin:0 0 7px}.kurti-information-dialog a{color:#b91c1c;text-decoration:underline;text-underline-offset:3px}.kurti-information-control:focus-visible,.kurti-information-dialog :is(button,a):focus-visible{outline:2px solid #64748b;outline-offset:2px}`}</style>
    </div>, document.body)}
  </>;
}
