import type { SmDashboardMetricSummary, SmDashboardOverviewMetrics } from "@/types/smDashboard";
import { ClipboardCheck } from "lucide-react";
import styles from "./SmDashboardOverview.module.css";

const decimal = (value: number | null | undefined, digits = 1) => value == null ? "—" : value.toLocaleString("de-AT", { minimumFractionDigits: digits, maximumFractionDigits: digits });
const count = (value: number | null | undefined) => decimal(value, 0);
const percent = (value: number | null | undefined, plus = false) => value == null ? "—" : `${plus && value > 0 ? "+" : ""}${decimal(value)} %`;

function Value({ children, loading, tone, unit }: { children: string; loading?: boolean; tone?: "green" | "red"; unit?: string }) {
  const percentUnit = !unit && children.endsWith(" %");
  const valueText = percentUnit ? children.slice(0, -2) : children;
  const valueUnit = unit ?? (percentUnit ? "%" : undefined);
  return <strong className={`${styles.value} ${children === "—" && !loading ? styles.unavailable : tone ? styles[tone] : ""}`}>{loading ? <span className={styles.placeholder} /> : <>{valueText}{valueUnit && <span className={styles.unit}>{valueUnit}</span>}</>}</strong>;
}

export function SmDashboardOverview({ overview, summary, loading = false }: { overview?: SmDashboardOverviewMetrics; summary?: SmDashboardMetricSummary | null; loading?: boolean }) {
  const activity = overview?.activity;
  const result = overview?.performance;
  const visits = activity?.visits ?? summary?.completedVisits;
  const markets = activity?.visitedMarkets ?? summary?.submittedMarkets;
  const visitsPerMarket = activity?.visitsPerMarket ?? (visits != null && markets ? visits / markets : null);
  const base = [
    { label: "Besuchte Märkte", value: count(markets) },
    { label: "Leistungsstunden", value: decimal(activity?.marketHours), unit: activity?.marketHours == null ? undefined : "h" },
    { label: "Merchandiser", value: count(activity?.merchandisers) },
  ];
  const metrics = [
    { label: "Durchgeführte Basistätigkeiten", value: percent(result?.basicActivityRate), tone: "green" as const,
      detail: result?.basicActivityAnswers ? `${count(result.basicActivityAnswers)} gewertete Antworten · teilweise zählt halb` : "Noch keine zugeordneten Antworten" },
    { label: "Märkte mit OOS", value: percent(result?.affectedMarketRate ?? summary?.affectedMarketRate), tone: "red" as const,
      detail: `${count(result?.affectedMarkets ?? summary?.marketsWithOos)} von ${count(result?.observedMarkets ?? summary?.observedMarkets)} geprüften Märkten` },
    { label: "Häufigkeit vorgefundener OOS", value: count(result?.foundCategoryCases ?? summary?.foundCases), tone: "red" as const,
      detail: "Mindestens ein OOS je Besuch und Kategorie" },
    { label: "OOS-Behebungsquote", value: percent(result?.remediationRate), tone: "green" as const,
      detail: result?.foundCategoryCases ? `${count(result.fixedCategoryCases)} von ${count(result.foundCategoryCases)} Fällen behoben` : result?.categoryChecks ? "Kein OOS mit Behebungsbedarf" : "Noch keine auswertbaren Kategorieprüfungen" },
    { label: "Steigerung der Warenverfügbarkeit", value: percent(result?.availabilityGain, true), tone: "green" as const,
      detail: result?.categoryChecks ? `${count(result.fixedCategoryCases)} von ${count(result.categoryChecks)} Kategorieprüfungen zurückgewonnen` : "Vom Ganzen durch OOS-Behebung zurückgewonnen" },
    { label: "Warenverfügbarkeit nach OOS-Behebung", value: percent(result?.availabilityAfter), tone: "green" as const,
      detail: result?.availabilityBefore == null ? "Noch keine auswertbaren Kategorieprüfungen" : `${percent(result.availabilityBefore)} vor der Tätigkeit → ${percent(result.availabilityAfter)} danach` },
  ];
  const availability = !loading && result?.availabilityBefore != null && result.availabilityGain != null && result.availabilityAfter != null
    ? { before: result.availabilityBefore, gain: result.availabilityGain, after: result.availabilityAfter }
    : null;
  const shareWidth = (value: number) => `${Math.max(0, Math.min(100, value))}%`;
  return <div className={styles.overview} aria-busy={loading || undefined}>
    <article className={styles.activity} aria-label="Besuchsübersicht">
      <div className={styles.heading}><h2>Besuchsübersicht</h2><span>Im gewählten Zeitraum</span></div>
      <div className={styles.activityBody}>
        <section className={styles.visitAnchor} aria-label="Marktbesuche">
          <dl><dt><ClipboardCheck size={16} strokeWidth={1.65} aria-hidden="true" />Marktbesuche</dt><dd><Value loading={loading}>{count(visits)}</Value></dd></dl>
          <p>Abgeschlossene Besuche<br />im gewählten Zeitraum</p>
        </section>
        <div className={styles.activityContext}>
          <dl className={styles.base}>{base.map(item => <div key={item.label}><dt>{item.label}</dt><dd><Value loading={loading} unit={item.unit}>{item.value}</Value></dd></div>)}</dl>
          <dl className={styles.averages}>
            <div><dt>Besuche / Markt</dt><dd>{loading ? "—" : decimal(visitsPerMarket)}</dd><small>Marktbesuche ÷ besuchte Märkte</small></div>
            <div><dt>Stunden / Besuch</dt><dd>{loading ? "—" : activity?.hoursPerVisit == null ? "—" : <>{decimal(activity.hoursPerVisit)}<span className={styles.unit}>h</span></>}</dd><small>{activity?.missingTimeVisits ? `ZE unvollständig · ${count(activity.timedVisits)} von ${count(activity.visits)} Besuchen erfasst` : "Leistungsstunden ÷ Marktbesuche"}</small></div>
          </dl>
        </div>
      </div>
    </article>
    <article className={styles.performance} aria-label="Leistung im Markt">
      <div className={styles.heading}><h2>Leistung im Markt</h2>{!loading && <details className={styles.help}><summary>Berechnung</summary><div>
        <p><b>Basistätigkeiten:</b> Ja zählt 1, teilweise 0,5 und Nein 0. Der Wert bezieht sich auf zugeordnete Antworten.</p>
        <p><b>Märkte mit OOS:</b> unterschiedliche betroffene Märkte im Verhältnis zu allen geprüften Märkten.</p>
        <p><b>Häufigkeit:</b> jede betroffene Kategorie zählt pro Besuch einmal. Wiederholte Besuche zählen erneut.</p>
        <p><b>Behebung:</b> vollständig und teilweise behobene Fälle zählen als behoben.</p>
        <p><b>Steigerung:</b> behobene Kategorie-Fälle ÷ alle Kategorieprüfungen × 100. Der Wert ist der zurückgewonnene Anteil des Ganzen, kein relativer Vorher-/Nachher-Vergleich. {result ? `${count(result.categoryChecks)} auswertbare Kategorieprüfungen im Zeitraum.` : ""}</p>
        <p><b>Verfügbarkeit danach:</b> der vorher verfügbare Anteil plus der zurückgewonnene Anteil. Die Werte sind aus Kategoriebeobachtungen abgeleitet.</p>
      </div></details>}</div>
      <div className={styles.performanceBody}>
        <div className={styles.metrics}>{metrics.slice(0, 5).map((metric, index) => <section key={metric.label} className={`${styles.metric} ${index > 2 ? styles.metricWide : ""}`} aria-label={metric.label}>
          <h3><span className={`${styles.metricDot} ${metric.tone ? styles[metric.tone] : ""}`} aria-hidden="true" />{metric.label}</h3>
          <Value loading={loading} tone={metric.tone}>{metric.value}</Value><p>{loading ? "Wird berechnet …" : metric.detail}</p>
        </section>)}</div>
        <section className={styles.resultPanel} aria-label={metrics[5].label}>
          <h3>Warenverfügbarkeit</h3>
          {availability ? <>
            <dl className={styles.resultSequence}>
              <div className={styles.resultBefore}><dt>Vor Behebung</dt><dd>{percent(availability.before)}</dd></div>
              <div className={styles.resultAdded}><dt><span aria-hidden="true">+</span>Zurückgewonnen</dt><dd>{percent(availability.gain, true)}</dd></div>
              <div className={styles.resultAfter}><dt>Nach Behebung</dt><dd><Value tone="green">{metrics[5].value}</Value></dd></div>
            </dl>
            <div className={styles.resultScale}>
              <div className={styles.resultRail} aria-hidden="true">
                <i className={styles.scaleBefore} style={{ width: shareWidth(availability.before) }} />
                <i className={styles.scaleRecovered} style={{ width: shareWidth(availability.gain) }} />
                <i className={styles.scaleRemaining} style={{ width: shareWidth(100 - availability.after) }} />
              </div>
              <div className={styles.scaleLabels} aria-hidden="true"><span>0 %</span><span>100 %</span></div>
              <ul className={styles.scaleLegend} aria-label="Legende Warenverfügbarkeit">
                <li><i className={styles.scaleBefore} aria-hidden="true" />Vorher</li>
                <li><i className={styles.scaleRecovered} aria-hidden="true" />Zurückgewonnen</li>
                <li><i className={styles.scaleRemaining} aria-hidden="true" />Offen</li>
              </ul>
            </div>
          </> : <>
            <Value loading={loading} tone="green">{metrics[5].value}</Value>
            <p className={styles.resultEmpty}>{loading ? "Wird berechnet …" : "Mit den ersten auswertbaren Antworten erscheint der Vorher-/Nachher-Vergleich."}</p>
          </>}
        </section>
      </div>
      {!!result?.missingRemediationCases && <p className={styles.coverage}>{count(result.missingRemediationCases)} gefundene Fälle ohne Behebungsantwort · nur dokumentierte Behebung wird angerechnet.</p>}
    </article>
  </div>;
}
