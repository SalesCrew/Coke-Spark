import type { SmDashboardPayload } from "@/types/smDashboard";

export function smDashboardOverviewExportRows(payload: SmDashboardPayload) {
  const value = payload.overview;
  if (!value) return [];
  const a = value.activity, p = value.performance;
  const row = (label: string, amount: number | null, numerator: number | null, denominator: number | null, unit = "Anzahl") => ({ label, value: amount, numerator, denominator, unit });
  return [
    row("Besuchte Märkte", a.visitedMarkets, a.visitedMarkets, null),
    row("Marktbesuche", a.visits, a.visits, null),
    row("Leistungsstunden", a.marketHours, a.marketMinutes, 60, "Stunden"),
    row("Merchandiser", a.merchandisers, a.merchandisers, null),
    row("Besuche / Markt", a.visitsPerMarket, a.visits, a.visitedMarkets, "Besuche / Markt"),
    row("Stunden / Besuch", a.hoursPerVisit, a.marketHours, a.visits, "Stunden / Besuch"),
    row("Durchgeführte Basistätigkeiten", p.basicActivityRate, p.basicActivityPoints, p.basicActivityAnswers, "%"),
    row("Märkte mit OOS", p.affectedMarketRate, p.affectedMarkets, p.observedMarkets, "%"),
    row("Häufigkeit vorgefundener OOS", p.foundCategoryCases, p.foundCategoryCases, null),
    row("OOS-Behebungsquote", p.remediationRate, p.fixedCategoryCases, p.foundCategoryCases, "%"),
    row("Steigerung der Warenverfügbarkeit", p.availabilityGain, p.fixedCategoryCases, p.categoryChecks, "% vom Ganzen"),
    row("Warenverfügbarkeit nach OOS-Behebung", p.availabilityAfter, p.categoryChecks - p.foundCategoryCases + p.fixedCategoryCases, p.categoryChecks, "%"),
  ];
}
