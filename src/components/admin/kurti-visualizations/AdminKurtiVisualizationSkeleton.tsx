import type { AdminKurtiVisualization } from "@/lib/api/backend";
import styles from "./visualizations.module.css";

export type AdminKurtiVisualizationSkeletonKind = AdminKurtiVisualization["kind"];

function Bars({ waterfall = false }: { waterfall?: boolean }) {
  const heights = waterfall ? [58, 34, 46, 29, 66, 52] : [36, 58, 44, 71, 54, 78, 62, 69];
  return <div className={`${styles.skeletonBars} ${waterfall ? styles.skeletonWaterfall : ""}`}>{heights.map((height, index) => <span key={index} style={{ height: `${height}%` }} />)}</div>;
}

function SkeletonShape({ kind }: { kind: AdminKurtiVisualizationSkeletonKind }) {
  if (kind === "composition") return <div className={styles.skeletonComposition}><span className={styles.skeletonRing} /><div className={styles.skeletonLegend}>{[0, 1, 2, 3].map((item) => <span key={item} />)}</div></div>;
  if (kind === "scatter") return <div className={styles.skeletonPlot}>{[18, 31, 45, 58, 72, 83, 38, 67].map((left, index) => <span className={styles.skeletonPoint} key={left} style={{ left: `${left}%`, bottom: `${18 + (index * 13) % 65}%`, width: `${6 + index % 3 * 3}px`, height: `${6 + index % 3 * 3}px` }} />)}</div>;
  if (kind === "heatmap") return <div className={styles.skeletonHeatmap}>{Array.from({ length: 40 }, (_, index) => <span key={index} style={{ opacity: 0.3 + (index % 7) * 0.07 }} />)}</div>;
  if (kind === "metrics") return <div className={styles.skeletonMetrics}>{Array.from({ length: 6 }, (_, index) => <span key={index}><i /><b /></span>)}</div>;
  if (kind === "table") return <div className={styles.skeletonTable}>{Array.from({ length: 6 }, (_, index) => <span key={index}><i /><i /><i /></span>)}</div>;
  if (kind === "timeline") return <div className={styles.skeletonTimeline}>{Array.from({ length: 5 }, (_, index) => <span key={index}><i /><b /></span>)}</div>;
  if (kind === "radar") return <div className={styles.skeletonRadar}><span /><i /><i /><i /></div>;
  if (kind === "distribution") return <Bars />;
  if (kind === "waterfall") return <Bars waterfall />;
  if (kind === "treemap") return <div className={styles.skeletonTreemap}><span /><span /><span /><span /><span /><span /></div>;
  return (
    <div className={styles.skeletonPlot}>
      <svg viewBox="0 0 300 105" preserveAspectRatio="none" aria-hidden="true">
        <path d="M8 86 C40 72 48 78 76 56 S118 67 145 38 S189 55 216 30 S260 38 292 16" />
        <path className={styles.skeletonSecondaryLine} d="M8 72 C42 62 55 51 82 66 S129 48 154 57 S204 32 230 42 S267 29 292 35" />
      </svg>
    </div>
  );
}

export function AdminKurtiVisualizationSkeleton({ kind }: { kind: AdminKurtiVisualizationSkeletonKind }) {
  return (
    <section className={`${styles.frame} ${styles.skeletonFrame}`} aria-label="Visualisierung wird vorbereitet" aria-busy="true">
      <div className={styles.skeletonHeader}>
        <span className={styles.skeletonTitle} />
        <span className={styles.skeletonPill} />
      </div>
      <span className={styles.skeletonSubtitle} />
      <div className={styles.skeletonBody}><SkeletonShape kind={kind} /></div>
      <div className={styles.skeletonMeta}><span /><span /></div>
    </section>
  );
}
