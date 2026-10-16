import type { CSSProperties } from "react";
import { SmDashboardOverview } from "./SmDashboardOverview";

function SkeletonBlock({ width = "100%", height = 9 }: Pick<CSSProperties, "width" | "height">) {
  return <span className="sm-live-skeleton" style={{ width, height }} />;
}

function SkeletonRate({ width }: { width: string }) {
  return (
    <span className="sm-live-rate">
      <SkeletonBlock width={38} height={8} />
      <i><SkeletonBlock width={width} height="100%" /></i>
    </span>
  );
}

function DimensionSkeleton({ title }: { title: string }) {
  return (
    <article className="sm-live-card">
      <div className="sm-live-card-head">
        <div><h2>{title}</h2><p>Live-Fälle · Besuchsgewichtet</p></div>
      </div>
      <div className="sm-live-dimension">
        <div className="sm-live-dimension-head">
          <span>Bereich</span><span>Besuche</span><span>OOS</span><span>Behoben</span><span>Märkte mit OOS</span>
        </div>
        {["64%", "42%", "76%"].map((width) => (
          <div className="sm-live-dimension-row" key={width}>
            <SkeletonBlock width={width} />
            <SkeletonBlock width={24} />
            <SkeletonBlock width={20} />
            <SkeletonRate width={width} />
            <SkeletonRate width={width} />
          </div>
        ))}
      </div>
    </article>
  );
}

/** Uses the live dashboard's layout classes so loading follows the same breakpoints. */
export function SmDashboardSkeleton() {
  return (
    <div className="sm-live-loading" role="status">
      <span className="sm-live-loading-label">SM-Dashboard wird geladen</span>
      <div className="sm-live-loading-layout" aria-hidden="true">
        <SmDashboardOverview loading />

        <article className="sm-live-card">
          <div className="sm-live-card-head">
            <div><h2>OOS & Behebung nach Kategorie</h2><p>Fallzahl, Besuchsquote und Marktbetroffenheit aus denselben aktuellen Antworten</p></div>
          </div>
          <div className="sm-live-category">
            <div className="sm-live-category-head">
              <span>Kategorie</span><span>Gefunden</span><span>OOS-Quote</span><span>Behoben</span><span>Behebungsquote</span><span>Märkte mit OOS</span>
            </div>
            {["68%", "82%", "56%", "74%"].map((width) => (
              <div className="sm-live-category-row" key={width}>
                <SkeletonBlock width={width} />
                <SkeletonBlock width={40} />
                <SkeletonRate width={width} />
                <SkeletonBlock width={36} />
                <SkeletonRate width={width} />
                <SkeletonBlock width={90} />
              </div>
            ))}
          </div>
        </article>

        <div className="sm-live-bottom">
          <DimensionSkeleton title="Handelsketten im Vergleich" />
          <DimensionSkeleton title="Regionen im Vergleich" />
        </div>
      </div>
    </div>
  );
}
