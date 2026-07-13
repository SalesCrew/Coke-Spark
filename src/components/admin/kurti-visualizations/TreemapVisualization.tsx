import type { AdminKurtiTreemapVisualization } from "@/lib/api/backend";
import { VisualizationFrame } from "./VisualizationFrame";
import { formatVisualizationValue, TONE_COLORS } from "./visualizationUtils";
import styles from "./visualizations.module.css";

type TreemapItem = AdminKurtiTreemapVisualization["items"][number];
type TreemapRect = { item: TreemapItem; x: number; y: number; width: number; height: number };

function layoutTreemap(items: TreemapItem[], x: number, y: number, width: number, height: number): TreemapRect[] {
  if (items.length === 0) return [];
  if (items.length === 1) return [{ item: items[0]!, x, y, width, height }];
  const total = items.reduce((sum, item) => sum + item.value, 0);
  let cumulative = 0;
  let splitIndex = 1;
  for (let index = 0; index < items.length - 1; index += 1) {
    cumulative += items[index]!.value;
    splitIndex = index + 1;
    if (cumulative >= total / 2) break;
  }
  const first = items.slice(0, splitIndex);
  const second = items.slice(splitIndex);
  const firstTotal = first.reduce((sum, item) => sum + item.value, 0);
  const ratio = total > 0 ? firstTotal / total : first.length / items.length;
  if (width >= height) {
    const firstWidth = width * ratio;
    return [...layoutTreemap(first, x, y, firstWidth, height), ...layoutTreemap(second, x + firstWidth, y, width - firstWidth, height)];
  }
  const firstHeight = height * ratio;
  return [...layoutTreemap(first, x, y, width, firstHeight), ...layoutTreemap(second, x, y + firstHeight, width, height - firstHeight)];
}

export function TreemapVisualization({ visualization }: { visualization: AdminKurtiTreemapVisualization }) {
  const items = [...visualization.items].filter((item) => item.value > 0).sort((a, b) => b.value - a.value);
  const total = items.reduce((sum, item) => sum + item.value, 0);
  const rects = layoutTreemap(items, 0, 0, 600, 300);
  return (
    <VisualizationFrame {...visualization}>
      <div className={`${styles.scroll} ${styles.surface}`} style={{ overflowX: "auto", borderRadius: 10 }}>
        <svg role="img" aria-label={`Treemap: ${visualization.title}`} viewBox="0 0 600 300" style={{ display: "block", minWidth: 380, width: "100%", height: "auto" }}>
          <defs><filter id="treemap-soft-shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#0f172a" floodOpacity="0.09" /></filter></defs>
          {rects.map(({ item, x, y, width, height }, index) => {
            const inset = 2;
            const innerWidth = Math.max(0, width - inset * 2);
            const innerHeight = Math.max(0, height - inset * 2);
            const showLabel = innerWidth > 58 && innerHeight > 30;
            const showValue = innerWidth > 76 && innerHeight > 48;
            const share = total > 0 ? (item.value / total) * 100 : 0;
            return (
              <g key={`${item.label}-${index}`} filter="url(#treemap-soft-shadow)">
                <rect x={x + inset} y={y + inset} width={innerWidth} height={innerHeight} rx="6" fill={TONE_COLORS[item.tone]} fillOpacity={0.18 + Math.min(0.48, share / 100)} stroke="rgba(255,255,255,0.72)" strokeWidth="0.8">
                  <title>{`${item.label}: ${formatVisualizationValue(item.value, visualization.valueFormat)} · ${share.toFixed(1)} %`}</title>
                </rect>
                {showLabel ? <text x={x + 9} y={y + 17} fill="rgba(15,23,42,0.78)" fontSize="9.2" fontWeight="680">{item.label.length > Math.max(7, Math.floor(innerWidth / 7)) ? `${item.label.slice(0, Math.max(6, Math.floor(innerWidth / 7) - 1))}…` : item.label}</text> : null}
                {showValue ? <text x={x + 9} y={y + 31} fill="rgba(51,65,85,0.6)" fontSize="8.2">{formatVisualizationValue(item.value, visualization.valueFormat)} · {share.toFixed(1)} %</text> : null}
              </g>
            );
          })}
        </svg>
      </div>
    </VisualizationFrame>
  );
}
