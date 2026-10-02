import type { CSSProperties } from "react";

type ChartSkeletonKind = "line" | "bars" | "distribution" | "bubbles" | "semicircle" | "goal" | "column";

/** Covers only the plot. Its mounted chart keeps its dimensions and local state. */
export function ChartSkeleton({
  kind,
  label = "Diagramm wird geladen …",
  height,
}: {
  kind: ChartSkeletonKind;
  label?: string;
  height?: number;
}) {
  const round = kind === "bubbles" || kind === "semicircle" || kind === "goal";
  return (
    <div
      className="gm-chart-skeleton"
      data-chart-skeleton={kind}
      role="status"
      aria-busy="true"
      style={height === undefined ? undefined : { position: "relative", height }}
    >
      <span className="sr-only">{label}</span>
      <div className="gm-chart-skeleton-art" aria-hidden="true">
        <svg
          viewBox={kind === "semicircle" ? "0 0 360 160" : "0 0 600 300"}
          preserveAspectRatio={round ? "xMidYMid meet" : "none"}
          width="100%"
          height="100%"
          fill="none"
        >
          {kind === "semicircle" ? (
            <>
              <path d="M 72 146 A 108 108 0 0 1 288 146" stroke="var(--gm-skeleton-fill)" strokeWidth="30" />
              <path d="M 174 23 L 177 53 M 242 38 L 225 63" stroke="white" strokeWidth="7" />
              <rect x="147" y="97" width="66" height="25" rx="6" fill="var(--gm-skeleton-fill)" />
            </>
          ) : kind === "bubbles" ? (
            <>
              <circle cx="206" cy="165" r="100" fill="var(--gm-skeleton-soft)" stroke="var(--gm-skeleton-fill)" strokeWidth="3" />
              <circle cx="425" cy="193" r="72" fill="var(--gm-skeleton-soft)" stroke="var(--gm-skeleton-fill)" strokeWidth="3" />
              <rect x="171" y="157" width="70" height="16" rx="8" fill="var(--gm-skeleton-fill)" />
              <rect x="397" y="185" width="56" height="16" rx="8" fill="var(--gm-skeleton-fill)" />
            </>
          ) : kind === "goal" ? (
            <>
              <circle cx="154" cy="148" r="93" stroke="var(--gm-skeleton-fill)" strokeWidth="17" />
              <rect x="120" y="139" width="68" height="18" rx="7" fill="var(--gm-skeleton-fill)" />
              {[78, 114, 180, 216].map((y, i) => (
                <rect key={y} x="295" y={y} width={i % 2 === 0 ? 170 : 105} height={i === 1 ? 25 : 10} rx="5" fill="var(--gm-skeleton-fill)" />
              ))}
            </>
          ) : kind === "column" ? (
            <rect x="32" y="8" width="536" height="284" rx="18" fill="var(--gm-skeleton-soft)" stroke="var(--gm-skeleton-fill)" strokeWidth="3" />
          ) : (
            <>
              {[48, 111, 174, 237].map((y) => (
                <line key={y} x1="24" x2="582" y1={y} y2={y} stroke="var(--gm-skeleton-grid)" strokeDasharray={y === 237 ? undefined : "3 7"} />
              ))}
              {kind === "line" ? (
                <>
                  <path d="M 24 174 C 65 174 82 132 125 132 S 189 160 225 151 S 287 90 336 107 S 400 154 440 122 S 520 61 582 80 L 582 237 L 24 237 Z" fill="var(--gm-skeleton-soft)" />
                  <path d="M 24 174 C 65 174 82 132 125 132 S 189 160 225 151 S 287 90 336 107 S 400 154 440 122 S 520 61 582 80" stroke="var(--gm-skeleton-fill)" strokeWidth="4" strokeLinecap="round" />
                </>
              ) : (
                [117, 162, 138, 178, 146, 105].map((barHeight, i) => (
                  <g key={i}>
                    <rect x={48 + i * 91} y={237 - barHeight} width={kind === "distribution" ? 43 : 23} height={barHeight} rx="5" fill="var(--gm-skeleton-fill)" />
                    {kind !== "distribution" && <rect x={76 + i * 91} y={237 - barHeight * 0.65} width="23" height={barHeight * 0.65} rx="5" fill="var(--gm-skeleton-soft)" />}
                  </g>
                ))
              )}
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <rect key={i} x={45 + i * 91} y="270" width="46" height="7" rx="3.5" fill="var(--gm-skeleton-fill)" />
              ))}
            </>
          )}
        </svg>
      </div>
    </div>
  );
}

/** Replaces a pending value without displaying a fabricated number. */
export function ChartSkeletonValue({ style }: { style?: CSSProperties }) {
  return <span aria-hidden="true" className="gm-chart-skeleton-value" style={style} />;
}
