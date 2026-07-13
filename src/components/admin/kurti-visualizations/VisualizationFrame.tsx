import type { ReactNode } from "react";
import styles from "./visualizations.module.css";

type VisualizationFrameProps = {
  title: string;
  subtitle: string | null;
  sourceLabel: string | null;
  timeframe: string | null;
  note: string | null;
  children: ReactNode;
  legend?: ReactNode;
};

export function VisualizationFrame({ title, subtitle, sourceLabel, timeframe, note, children, legend }: VisualizationFrameProps) {
  return (
    <section
      aria-label={title}
      className={styles.frame}
    >
      <div className={styles.header}>
        <div className={styles.titleWrap}>
          <div className={styles.title}>{title}</div>
          {subtitle ? <div className={styles.subtitle}>{subtitle}</div> : null}
        </div>
        {timeframe ? (
          <span className={styles.timeframe}>{timeframe}</span>
        ) : null}
      </div>
      {legend ? <div className={`${styles.legendWrap} ${styles.scroll}`}>{legend}</div> : null}
      <div className={styles.body}>{children}</div>
      {(sourceLabel || note) ? (
        <div className={styles.meta}>
          {sourceLabel ? <span>Quelle: {sourceLabel}</span> : null}
          {note ? <span>{note}</span> : null}
        </div>
      ) : null}
    </section>
  );
}
