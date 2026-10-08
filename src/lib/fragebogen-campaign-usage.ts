export type QuestionnaireCampaignSection = "standard" | "flex" | "billa" | "kuehler" | "mhd" | "durcharbeit";
export type QuestionnaireCampaignUsage = {
  id: string;
  name: string;
  section: QuestionnaireCampaignSection;
  currentFragebogenId: string | null;
  status: "active" | "scheduled" | "inactive";
  scheduleType: "always" | "scheduled";
  startDate: string | null;
  endDate: string | null;
};
export type FragebogenUsage = {
  status: "active" | "scheduled" | "inactive" | "loading" | "unavailable";
  label: string;
  detail: string;
  title: string;
  startDate?: string;
};

export const unusedFragebogenUsage: FragebogenUsage = { status: "inactive", label: "Nicht in Verwendung", detail: "Keine laufende Kampagne", title: "Keiner laufenden oder geplanten Kampagne zugeordnet." };
export const loadingFragebogenUsage: FragebogenUsage = { status: "loading", label: "Wird geprüft", detail: "Kampagnen werden geladen", title: "Die aktuelle Kampagnenverwendung wird geladen." };
export const unavailableFragebogenUsage: FragebogenUsage = { status: "unavailable", label: "Status nicht verfügbar", detail: "Verwendung nicht verfügbar", title: "Kampagnen konnten nicht geladen werden. Beim erneuten Öffnen wird die Anzeige aktualisiert." };

function isDate(value: string | null): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(`${value}T12:00:00Z`))
    && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
}
function formatDate(value: string) { return value.split("-").reverse().join("."); }

/** Matches campaign availability, independently of the saved questionnaire/template status. */
export function questionnaireCampaignState(campaign: QuestionnaireCampaignUsage, today: string): "active" | "scheduled" | "inactive" {
  if (campaign.status === "inactive") return "inactive";
  if (campaign.scheduleType === "always") return campaign.status === "active" ? "active" : "inactive";
  if (!isDate(campaign.startDate) || !isDate(campaign.endDate) || campaign.startDate > campaign.endDate) return "inactive";
  if (today < campaign.startDate) return "scheduled";
  return today <= campaign.endDate ? "active" : "inactive";
}

export function buildFragebogenUsage(campaigns: readonly QuestionnaireCampaignUsage[], section: QuestionnaireCampaignSection, now = new Date()): Map<string, FragebogenUsage> {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Vienna", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const groups = new Map<string, { active: QuestionnaireCampaignUsage[]; scheduled: QuestionnaireCampaignUsage[] }>();
  const seen = new Set<string>();
  for (const campaign of campaigns) {
    if (campaign.section !== section || !campaign.currentFragebogenId || seen.has(campaign.id)) continue;
    seen.add(campaign.id);
    const status = questionnaireCampaignState(campaign, today);
    if (status === "inactive") continue;
    const group = groups.get(campaign.currentFragebogenId) ?? { active: [], scheduled: [] };
    group[status].push(campaign);
    groups.set(campaign.currentFragebogenId, group);
  }
  return new Map(Array.from(groups, ([id, group]) => {
    const active = group.active.length > 0;
    const selected = active ? group.active : group.scheduled.sort((a, b) => (a.startDate ?? "").localeCompare(b.startDate ?? ""));
    const first = selected[0];
    const range = selected.length === 1 && first.startDate && first.endDate && first.scheduleType === "scheduled"
      ? ` · ${formatDate(first.startDate)} – ${formatDate(first.endDate)}` : "";
    return [id, {
      status: active ? "active" : "scheduled",
      label: active ? "In Verwendung" : "Geplant",
      detail: `${selected.length} ${active ? "laufende" : "geplante"} ${selected.length === 1 ? "Kampagne" : "Kampagnen"}${range}`,
      title: [...group.active, ...group.scheduled].map(c => `${c.name} (${c.scheduleType === "always" ? "unbefristet" : `${formatDate(c.startDate!)} – ${formatDate(c.endDate!)}`})`).join("\n"),
      startDate: active ? undefined : first.startDate ?? undefined,
    } satisfies FragebogenUsage];
  }));
}

export function sortFragebogenByUsage<T extends { id: string }>(forms: readonly T[], usage: (id: string) => FragebogenUsage): T[] {
  const rank = { active: 0, scheduled: 1, inactive: 2, loading: 2, unavailable: 2 };
  return [...forms].sort((a, b) => {
    const left = usage(a.id), right = usage(b.id);
    return rank[left.status] - rank[right.status] || (left.status === "scheduled" && right.status === "scheduled" ? (left.startDate ?? "").localeCompare(right.startDate ?? "") : 0);
  });
}
