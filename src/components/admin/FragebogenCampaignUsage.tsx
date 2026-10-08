"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarRange, Layers } from "lucide-react";
import { fetchFragebogenCampaignUsage, type FragebogenScope } from "@/lib/api/backend";
import { buildFragebogenUsage, loadingFragebogenUsage, unavailableFragebogenUsage, unusedFragebogenUsage, type FragebogenUsage, type QuestionnaireCampaignSection, type QuestionnaireCampaignUsage } from "@/lib/fragebogen-campaign-usage";

/** One batched lookup per page; never derives live use from editable template metadata. */
export function useFragebogenCampaignUsage(scope: FragebogenScope, section: QuestionnaireCampaignSection) {
  const [snapshot, setSnapshot] = useState<{ scope: FragebogenScope; campaigns: QuestionnaireCampaignUsage[] | null; failed: boolean }>({ scope, campaigns: null, failed: false });
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let alive = true, inFlight = false;
    const refresh = async () => {
      if (inFlight || document.visibilityState === "hidden") return;
      inFlight = true;
      setNow(new Date());
      try {
        const campaigns = await fetchFragebogenCampaignUsage(scope);
        if (alive) setSnapshot({ scope, campaigns, failed: false });
      } catch {
        if (alive) setSnapshot({ scope, campaigns: null, failed: true });
      } finally { inFlight = false; }
    };
    void refresh();
    const onVisible = () => { if (document.visibilityState !== "hidden") void refresh(); };
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    const interval = window.setInterval(onVisible, 60_000);
    return () => { alive = false; window.clearInterval(interval); window.removeEventListener("focus", onVisible); document.removeEventListener("visibilitychange", onVisible); };
  }, [scope]);
  const byId = useMemo(() => buildFragebogenUsage(snapshot.campaigns ?? [], section, now), [snapshot.campaigns, section, now]);
  return (id: string): FragebogenUsage => snapshot.scope !== scope ? loadingFragebogenUsage : snapshot.failed ? unavailableFragebogenUsage : snapshot.campaigns === null ? loadingFragebogenUsage : byId.get(id) ?? unusedFragebogenUsage;
}

export function fragebogenUsageStyle(usage: FragebogenUsage, accent: string, accentBackground: string, planned = "#d97706") {
  return usage.status === "active" ? { bg: accentBackground, text: accent, dot: accent }
    : usage.status === "scheduled" ? { bg: "rgba(245,158,11,0.08)", text: planned, dot: planned }
    : { bg: "rgba(0,0,0,0.04)", text: "rgba(0,0,0,0.4)", dot: "rgba(0,0,0,0.2)" };
}

export function FragebogenUsageBadge({ usage, accent, background }: { usage: FragebogenUsage; accent: string; background: string }) {
  const colors = fragebogenUsageStyle(usage, accent, background);
  return <span title={usage.title} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 20, fontSize: 9, fontWeight: 600, backgroundColor: colors.bg, color: colors.text }}><span style={{ width: 5, height: 5, borderRadius: "50%", backgroundColor: colors.dot }} />{usage.label}</span>;
}

export function FragebogenUsageDetail({ usage }: { usage: FragebogenUsage }) {
  const color = usage.status === "active" ? "#059669" : usage.status === "scheduled" ? "#d97706" : "rgba(0,0,0,0.35)";
  const Icon = usage.status === "scheduled" ? CalendarRange : Layers;
  return <span title={usage.title} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10, fontWeight: 500, color }}><Icon size={11} strokeWidth={1.8} style={{ flexShrink: 0 }} />{usage.detail}</span>;
}
