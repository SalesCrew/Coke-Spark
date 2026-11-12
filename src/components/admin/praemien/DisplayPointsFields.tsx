"use client";

import type { MetricResult } from "@/types/praemien-workspace";
import styles from "./praemien.module.css";

type PointDraft = { value: string; target: string; rawPoints: string };
const number = (text: string) => text.trim() === "" ? null : Number(text.replace(",", "."));
const format = (value: number) => value.toLocaleString("de-AT", { maximumFractionDigits: 2 });

export function DisplayPointsFields({ metric, draft, frozen, onField }: {
  metric: MetricResult;
  draft: PointDraft;
  frozen: boolean;
  onField: (field: keyof PointDraft, value: string) => void;
}) {
  const override = number(draft.value);
  const manual = number(draft.rawPoints);
  const points = manual ?? metric.automaticPoints ?? null;
  const target = number(draft.target);
  const calculated = points !== null && Number.isFinite(points) && target !== null && Number.isFinite(target) && target > 0 ? points / target * 100 : null;
  const displayed = frozen ? metric.value : calculated;
  const provisional = manual === null && !!metric.missingSources?.length;
  const coverage = metric.sourceCoverage;
  return <>
    {override !== null && <div className={styles.percentOverride}>
      <div><strong>Bestehende Prozentvorgabe: {format(override)} %</strong><small>Bleibt wirksam, bis du ausdrücklich auf die Berechnung umstellst.</small></div>
      {!frozen && <button type="button" onClick={() => onField("value", "")}>Berechnung verwenden</button>}
    </div>}
    <div className={styles.twoColumns}>
      <div><label>Ist-Punkte
        <input aria-label="Ist-Punkte" inputMode="decimal" value={draft.rawPoints}
          placeholder={metric.automaticPoints == null ? frozen ? "Nicht separat erfasst" : "Keine Daten · manuell eintragen" : `Automatisch: ${format(metric.automaticPoints)}`}
          disabled={frozen || override !== null} onChange={e => onField("rawPoints", e.target.value)} />
      </label>
        <small>{manual !== null ? "Manuell erfasst" : coverage ? `${coverage.answered} von ${coverage.total} Quellen vollständig` : "Aus Besuchsantworten"}
          {!frozen && manual !== null && <button type="button" className={styles.inlineTextButton} onClick={() => onField("rawPoints", "")}>Automatisch verwenden</button>}
        </small>
      </div>
      <label>Persönlicher Sollwert
        <input aria-label="Persönlicher Sollwert" inputMode="decimal" value={draft.target} placeholder={frozen ? metric.target == null ? "Nicht separat erfasst" : String(metric.target).replace(".", ",") : "Sollwert eintragen"}
          disabled={frozen} onChange={e => onField("target", e.target.value)} />
        <small>Bei Abwesenheit unten berechnen</small>
      </label>
    </div>
    <div className={styles.pointsResult} role="status" aria-live="polite">
      <div><small>{frozen ? "Wirksame Zielerreichung" : override !== null ? "Vorschau der Berechnung" : "Berechnete Zielerreichung"}</small><strong>{displayed === null ? "—" : `${format(displayed)} %`}</strong></div>
      <span>{frozen ? metric.provisional ? "Vorläufiger Zwischenstand" : "Stand der Prämienwelle" : override !== null ? "Prozentvorgabe bleibt wirksam" : points === null ? "Noch keine Daten" : target === null || !Number.isFinite(target) || target <= 0 ? "Sollwert fehlt" : provisional ? "Vorläufiger Zwischenstand" : "Ist-Punkte ÷ Soll × 100"}</span>
    </div>
    {!!metric.missingSources?.length && <details className={styles.sourceGaps}>
      <summary>{metric.missingSources.length} {metric.missingSources.length === 1 ? "Quelle noch offen" : "Quellen noch offen"}</summary>
      <p>Vorhandene Antworten zählen bereits. Fehlende Werte werden nicht als null Punkte angenommen.</p>
      <ul>{metric.missingSources.map((s, i) => <li key={`${s.questionId}/${i}`}>{s.label || "Quelle ohne Bezeichnung"}</li>)}</ul>
    </details>}
  </>;
}
