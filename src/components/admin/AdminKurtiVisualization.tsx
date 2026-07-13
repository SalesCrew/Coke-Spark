import type { AdminKurtiVisualization as AdminKurtiVisualizationSpec } from "@/lib/api/backend";
import { CompositionVisualization } from "./kurti-visualizations/CompositionVisualization";
import { DistributionVisualization } from "./kurti-visualizations/DistributionVisualization";
import { HeatmapVisualization } from "./kurti-visualizations/HeatmapVisualization";
import { MetricsVisualization } from "./kurti-visualizations/MetricsVisualization";
import { RadarVisualization } from "./kurti-visualizations/RadarVisualization";
import { ScatterVisualization } from "./kurti-visualizations/ScatterVisualization";
import { SeriesVisualization } from "./kurti-visualizations/SeriesVisualization";
import { TableVisualization } from "./kurti-visualizations/TableVisualization";
import { TimelineVisualization } from "./kurti-visualizations/TimelineVisualization";
import { TreemapVisualization } from "./kurti-visualizations/TreemapVisualization";
import { WaterfallVisualization } from "./kurti-visualizations/WaterfallVisualization";

export function AdminKurtiVisualization({ visualization }: { visualization: AdminKurtiVisualizationSpec }) {
  switch (visualization.kind) {
    case "series": return <SeriesVisualization visualization={visualization} />;
    case "composition": return <CompositionVisualization visualization={visualization} />;
    case "scatter": return <ScatterVisualization visualization={visualization} />;
    case "heatmap": return <HeatmapVisualization visualization={visualization} />;
    case "metrics": return <MetricsVisualization visualization={visualization} />;
    case "table": return <TableVisualization visualization={visualization} />;
    case "timeline": return <TimelineVisualization visualization={visualization} />;
    case "radar": return <RadarVisualization visualization={visualization} />;
    case "distribution": return <DistributionVisualization visualization={visualization} />;
    case "waterfall": return <WaterfallVisualization visualization={visualization} />;
    case "treemap": return <TreemapVisualization visualization={visualization} />;
  }
}
