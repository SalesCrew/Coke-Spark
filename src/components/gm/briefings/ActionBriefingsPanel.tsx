"use client";
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  LoaderCircle,
} from "lucide-react";
import type { GmBriefing } from "@/types/gmBriefings";
import styles from "./action-briefings.module.css";

const date = (value: string) =>
  new Intl.DateTimeFormat("de-AT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Europe/Vienna",
  }).format(new Date(`${value}T12:00:00Z`));
export function ActionBriefingsPanel({
  items,
  loading,
  error,
  onBack,
  onReload,
  onOpen,
}: {
  items: GmBriefing[];
  loading: boolean;
  error: boolean;
  onBack: () => void;
  onReload: () => void;
  onOpen: (item: GmBriefing, button: HTMLButtonElement) => void;
}) {
  return (
    <div className={styles.panel} data-gm-action-briefings-panel>
      <header className={styles.header}>
        <button
          type="button"
          data-gm-action-briefings-back
          aria-label="Zurück zum GM-Menü"
          onClick={onBack}
        >
          <ChevronLeft size={15} />
        </button>
        <div>
          <h2>Aktionsbriefings</h2>
          <p>Aktuelle Unterlagen</p>
        </div>
      </header>
      <div className={styles.list}>
        {loading ? (
          <div className={styles.status} role="status">
            <LoaderCircle size={14} className={styles.spinner} />
            Briefings werden geladen …
          </div>
        ) : error ? (
          <div className={styles.status} role="alert">
            <p>Briefings konnten nicht geladen werden.</p>
            <button type="button" onClick={onReload}>
              Erneut laden
            </button>
          </div>
        ) : !items.length ? (
          <div className={styles.status}>Aktuell keine Aktionsbriefings.</div>
        ) : (
          items.map((item) => (
            <article className={styles.item} key={item.id}>
              <div className={styles.title}>
                <h3>{item.title}</h3>
                {!item.readAt && <span>Neu</span>}
              </div>
              <p className={styles.period}>
                {date(item.visibleFrom)}
                {item.visibleUntil ? ` – ${date(item.visibleUntil)}` : ""}
              </p>
              <button
                type="button"
                className={styles.pdfButton}
                aria-label={`${item.title} öffnen`}
                aria-haspopup="dialog"
                onClick={(event) => onOpen(item, event.currentTarget)}
              >
                <span>Aktionsbriefing</span>
                <FileText size={14} strokeWidth={1.6} aria-hidden="true" />
                <ChevronRight size={12} aria-hidden="true" />
              </button>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
