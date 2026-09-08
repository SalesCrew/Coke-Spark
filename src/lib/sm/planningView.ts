import type { AdminGmPlanningVisit } from "@/types/smPlanning";

export type GmPlanningFilters = {
  search: string;
  gmUserId: string;
  region: string;
  section: string;
};

export function filterAdminGmPlanningVisits(visits: AdminGmPlanningVisit[], filters: GmPlanningFilters): AdminGmPlanningVisit[] {
  const search = filters.search.trim().toLocaleLowerCase("de-AT");
  return visits.filter((visit) => {
    const matchesSearch = !search || [visit.gm.name, visit.market.name, visit.market.internalId, visit.market.address, visit.market.city]
      .some((value) => value.toLocaleLowerCase("de-AT").includes(search));
    return matchesSearch
      && (filters.gmUserId === "all" || visit.gm.id === filters.gmUserId)
      && (filters.region === "all" || visit.market.region === filters.region)
      && (filters.section === "all" || visit.sections.some((entry) => entry.section === filters.section));
  });
}

export function recommendedUserFirst<T extends { id: string; firstName: string; lastName: string }>(users: T[], recommendedUserId: string | null): T[] {
  return [...users].sort((left, right) => {
    const recommendationOrder = Number(right.id === recommendedUserId) - Number(left.id === recommendedUserId);
    if (recommendationOrder) return recommendationOrder;
    return `${left.firstName} ${left.lastName}`.trim().localeCompare(`${right.firstName} ${right.lastName}`.trim(), "de-AT");
  });
}
