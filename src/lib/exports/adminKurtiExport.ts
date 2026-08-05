import {
  fetchAdminDiaetenExport,
  fetchAdminLager,
  fetchAdminPhotos,
  fetchAdminZeiterfassungDays,
  fetchAdminZeitenaufstellungExport,
  fetchCampaigns,
  fetchFragebogen,
  fetchGmUsers,
  fetchMarkets,
  fetchModules,
  fetchSmUsers,
  readAuthSession,
  type AdminKurtiExcelExport,
  type AdminPhotoArchiveFilters,
  type AdminPhotoArchiveItem,
  type AdminZeiterfassungSession,
  type AdminZeitenaufstellungExportRow,
  type FragebogenScope,
} from "@/lib/api/backend";
import type { Campaign, CampaignSection } from "@/types/campaign";
import type { Fragebogen, Module } from "@/types/fragebogen";
import type { GMRecord } from "@/types/gebietsmanager";
import type { LagerRecord } from "@/types/lager";
import type { MarketRecord } from "@/types/markets";
import type { SMRecord } from "@/types/shelfmerchandiser";

const TIMEZONE = "Europe/Vienna";
const PHOTO_PAGE_SIZE = 80;
const MAX_PHOTO_PAGES = 250;

function normalize(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("de-AT")
    .replace(/\s+/g, " ")
    .trim();
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map((entry) => entry.trim()).filter(Boolean)));
}

function matchesAny(haystack: string, values: string[]): boolean {
  if (values.length === 0) return true;
  const normalizedHaystack = normalize(haystack);
  return values.some((value) => normalizedHaystack.includes(normalize(value)));
}

function matchesSearch(haystack: string, search: string | null): boolean {
  const tokens = normalize(search).split(" ").filter(Boolean);
  if (tokens.length === 0) return true;
  const normalizedHaystack = normalize(haystack);
  return tokens.every((token) => normalizedHaystack.includes(token));
}

function matchesExact(value: string, allowedValues: string[]): boolean {
  if (allowedValues.length === 0) return true;
  const normalizedValue = normalize(value);
  return allowedValues.some((entry) => normalize(entry) === normalizedValue);
}

function matchesIdentity(
  id: string,
  haystack: string,
  requestedIds: string[],
  requestedNames: string[],
): boolean {
  if (requestedIds.length === 0 && requestedNames.length === 0) return true;
  return requestedIds.includes(id) || matchesAny(haystack, requestedNames);
}

function matchesStatus(value: string, requestedStatuses: string[], isLive = false): boolean {
  if (requestedStatuses.length === 0) return true;
  const aliases = new Set([normalize(value)]);
  if (isLive || value === "started") {
    aliases.add("live");
    aliases.add("laufend");
    aliases.add("gestartet");
  }
  if (value === "active") aliases.add("aktiv");
  if (value === "inactive") aliases.add("inaktiv");
  if (value === "scheduled") aliases.add("geplant");
  if (value === "ended") aliases.add("beendet");
  if (value === "submitted") {
    aliases.add("eingereicht");
    aliases.add("abgeschlossen");
  }
  return requestedStatuses.some((status) => aliases.has(normalize(status)));
}

function formatDate(value: string): string {
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}.${month}.${year}` : value;
}

function buildRange(exportSpec: AdminKurtiExcelExport) {
  const { dateFrom, dateTo } = exportSpec.filters;
  if (!dateFrom || !dateTo) {
    throw new Error("Dieser Export benötigt einen klaren Von-bis-Zeitraum.");
  }
  return {
    from: dateFrom,
    to: dateTo,
    label: `${formatDate(dateFrom)} - ${formatDate(dateTo)}`,
    filenameLabel: `${dateFrom}_bis_${dateTo}`,
  };
}

function exportedBy(): string {
  return readAuthSession()?.user.email ?? "";
}

async function resolveRequestedGmIds(exportSpec: AdminKurtiExcelExport): Promise<string[]> {
  const requestedIds = exportSpec.filters.gmUserIds;
  const requestedNames = exportSpec.filters.gmNames;
  if (requestedNames.length === 0) return unique(requestedIds);
  const gms = await fetchGmUsers();
  const matchingIds = gms
    .filter((gm) => matchesAny(`${gm.firstName} ${gm.lastName} ${gm.lastName} ${gm.firstName} ${gm.email}`, requestedNames))
    .map((gm) => gm.id);
  return unique([...requestedIds, ...matchingIds]);
}

function filterTimeSessions(
  sessions: AdminZeiterfassungSession[],
  exportSpec: AdminKurtiExcelExport,
  gmIds: string[],
): AdminZeiterfassungSession[] {
  const { gmNames, regions, statuses, search } = exportSpec.filters;
  return sessions.filter((session) => {
    if (!matchesIdentity(session.gmId, session.gmName, gmIds, gmNames)) return false;
    if (!matchesExact(session.region, regions)) return false;
    if (!matchesStatus(session.status, statuses, session.isLive)) return false;
    return matchesSearch([
      session.gmName,
      session.region,
      session.date,
      ...session.timeline.flatMap((entry) => [entry.title, entry.subtitle ?? "", entry.comment ?? ""]),
    ].join(" "), search);
  });
}

function filterZeitenaufstellungRows(
  rows: AdminZeitenaufstellungExportRow[],
  exportSpec: AdminKurtiExcelExport,
  resolvedGmNames: string[],
): AdminZeitenaufstellungExportRow[] {
  const { marketSearch, search } = exportSpec.filters;
  return rows.filter((row) => {
    if (!matchesAny(row.person, resolvedGmNames)) return false;
    if (!matchesSearch(`${row.targetObject} ${row.customerNumber}`, marketSearch)) return false;
    return matchesSearch([
      row.targetObject,
      row.customerNumber,
      row.person,
      row.comment,
      row.reason,
      row.questionnaire,
    ].join(" "), search);
  });
}

function filterMarkets(markets: MarketRecord[], exportSpec: AdminKurtiExcelExport): MarketRecord[] {
  const { marketIds, marketSearch, regions, statuses, search } = exportSpec.filters;
  return markets.filter((market) => {
    if (!matchesExact(market.region, regions)) return false;
    if (!matchesStatus(market.isActive ? "active" : "inactive", statuses)) return false;
    const identity = [
      market.name,
      market.dbName,
      market.address,
      market.postalCode,
      market.city,
      market.standardMarketNumber,
      market.cokeMasterNumber,
      market.flexNumber,
      market.kuehlerStammnr,
    ].join(" ");
    if (!matchesIdentity(market.id, identity, marketIds, marketSearch ? [marketSearch] : [])) return false;
    return matchesSearch(`${identity} ${market.region} ${market.currentGmName}`, search);
  });
}

function filterGms(gms: GMRecord[], exportSpec: AdminKurtiExcelExport): GMRecord[] {
  const { gmUserIds, gmNames, regions, statuses, search } = exportSpec.filters;
  return gms.filter((gm) => {
    const name = `${gm.firstName} ${gm.lastName}`;
    if (!matchesIdentity(gm.id, `${name} ${gm.email}`, gmUserIds, gmNames)) return false;
    if (!matchesExact(gm.region, regions)) return false;
    if (!matchesStatus(gm.isActive === false ? "inactive" : "active", statuses)) return false;
    return matchesSearch(`${name} ${gm.email} ${gm.region} ${gm.city} ${gm.postalCode}`, search);
  });
}

function filterSms(sms: SMRecord[], exportSpec: AdminKurtiExcelExport): SMRecord[] {
  const { gmUserIds, gmNames, regions, search } = exportSpec.filters;
  return sms.filter((sm) => {
    const name = `${sm.firstName} ${sm.lastName}`;
    if (!matchesIdentity(sm.id, `${name} ${sm.email}`, gmUserIds, gmNames)) return false;
    if (!matchesExact(sm.region, regions)) return false;
    return matchesSearch(`${name} ${sm.email} ${sm.region} ${sm.city} ${sm.postalCode}`, search);
  });
}

function filterLagers(
  lagers: LagerRecord[],
  gms: GMRecord[],
  exportSpec: AdminKurtiExcelExport,
  gmIds: string[],
): LagerRecord[] {
  const { gmNames, regions, search, marketSearch } = exportSpec.filters;
  const gmById = new Map(gms.map((gm) => [gm.id, gm]));
  return lagers.filter((lager) => {
    const assignedIds = lager.gmUserIds.length > 0 ? lager.gmUserIds : lager.gmUserId ? [lager.gmUserId] : [];
    const assignedGms = assignedIds.map((id) => gmById.get(id)).filter((gm): gm is GMRecord => Boolean(gm));
    if (gmIds.length > 0 || gmNames.length > 0) {
      const matchesGm = assignedIds.some((id) => gmIds.includes(id)) || matchesAny(lager.gmNames.join(" "), gmNames);
      if (!matchesGm) return false;
    }
    if (regions.length > 0 && !assignedGms.some((gm) => matchesExact(gm.region, regions))) return false;
    const haystack = `${lager.address} ${lager.postalCode} ${lager.city} ${lager.gmNames.join(" ")}`;
    return matchesSearch(haystack, marketSearch) && matchesSearch(haystack, search);
  });
}

function getQuestionnaireSection(kind: AdminKurtiExcelExport["kind"]): CampaignSection {
  switch (kind) {
    case "fragebogen_flex": return "flex";
    case "fragebogen_billa": return "billa";
    case "fragebogen_kuehler": return "kuehler";
    case "fragebogen_mhd": return "mhd";
    case "fragebogen_durcharbeit": return "durcharbeit";
    default: return "standard";
  }
}

function getQuestionnaireScope(section: CampaignSection): FragebogenScope {
  if (section === "kuehler" || section === "mhd" || section === "durcharbeit") return section;
  return "main";
}

function hasSectionKeyword(value: Module | Fragebogen, section: "standard" | "flex" | "billa"): boolean {
  const keywords = (value as Module & { sectionKeywords?: string[] }).sectionKeywords;
  if (section === "standard") return !keywords || keywords.length === 0 || keywords.includes("standard");
  return Boolean(keywords?.includes(section));
}

function filterQuestionnaireData(
  modules: Module[],
  fragebogen: Fragebogen[],
  campaigns: Campaign[],
  exportSpec: AdminKurtiExcelExport,
  section: CampaignSection,
): { modules: Module[]; fragebogen: Fragebogen[]; usage: Record<string, string[]> } {
  const { campaignIds, campaignNames, statuses, search } = exportSpec.filters;
  const selectedCampaigns = campaigns.filter((campaign) => {
    if (campaign.section !== section) return false;
    if (!matchesIdentity(campaign.id, campaign.name, campaignIds, campaignNames)) return false;
    if (!matchesStatus(campaign.status, statuses)) return false;
    return true;
  });
  const campaignFilterActive = campaignIds.length > 0 || campaignNames.length > 0 || statuses.length > 0;
  const allowedFragebogenIds = new Set(selectedCampaigns.map((campaign) => campaign.currentFragebogenId).filter((id): id is string => Boolean(id)));
  const sectionModules = section === "standard" || section === "flex" || section === "billa"
    ? modules.filter((module) => hasSectionKeyword(module, section))
    : modules;
  const sectionFragebogen = (section === "standard" || section === "flex" || section === "billa"
    ? fragebogen.filter((entry) => hasSectionKeyword(entry, section))
    : fragebogen)
    .filter((entry) => !campaignFilterActive || allowedFragebogenIds.has(entry.id))
    .filter((entry) => matchesSearch(`${entry.name} ${entry.description}`, search));
  const referencedModuleIds = new Set(sectionFragebogen.flatMap((entry) => entry.moduleIds));
  const filteredModules = sectionModules.filter((module) => {
    if (campaignFilterActive && !referencedModuleIds.has(module.id)) return false;
    return matchesSearch(`${module.name} ${module.description} ${module.questions.map((question) => question.text).join(" ")}`, search);
  });
  const usage: Record<string, string[]> = {};
  for (const campaign of selectedCampaigns) {
    if (!campaign.currentFragebogenId) continue;
    usage[campaign.currentFragebogenId] = unique([...(usage[campaign.currentFragebogenId] ?? []), campaign.name]);
  }
  return { modules: filteredModules, fragebogen: sectionFragebogen, usage };
}

function photoMatchesClientFilters(
  photo: AdminPhotoArchiveItem,
  exportSpec: AdminKurtiExcelExport,
  resolvedGmIds: string[],
  resolvedCampaignIds: string[],
): boolean {
  const { campaignIds, campaignNames, gmUserIds, gmNames, marketIds, marketSearch, regions, sections, search } = exportSpec.filters;
  if (!matchesIdentity(photo.campaign.id, photo.campaign.name, resolvedCampaignIds, campaignNames)) return false;
  if (!matchesIdentity(photo.gm.id, photo.gm.name, resolvedGmIds, gmNames)) return false;
  if (!matchesExact(photo.market.region, regions)) return false;
  if (sections.length > 0 && !sections.includes(photo.campaign.type)) return false;
  const marketIdentity = `${photo.market.name} ${photo.market.address} ${photo.market.postalCode} ${photo.market.city} ${photo.market.standardMarketNumber ?? ""} ${photo.market.cokeMasterNumber ?? ""}`;
  if (!matchesIdentity(photo.market.id, marketIdentity, marketIds, marketSearch ? [marketSearch] : [])) return false;
  return matchesSearch(`${marketIdentity} ${photo.campaign.name} ${photo.gm.name} ${photo.question.text} ${photo.tags.map((tag) => tag.label).join(" ")}`, search);
}

async function fetchAllFilteredPhotos(exportSpec: AdminKurtiExcelExport): Promise<AdminPhotoArchiveItem[]> {
  const { dateFrom, dateTo, campaignIds, gmUserIds, marketIds, regions, sections, search, marketSearch } = exportSpec.filters;
  const [resolvedGmIds, campaigns] = await Promise.all([
    resolveRequestedGmIds(exportSpec),
    exportSpec.filters.campaignNames.length > 0 ? fetchCampaigns() : Promise.resolve([] as Campaign[]),
  ]);
  const resolvedCampaignIds = unique([
    ...campaignIds,
    ...campaigns
      .filter((campaign) => matchesAny(campaign.name, exportSpec.filters.campaignNames))
      .map((campaign) => campaign.id),
  ]);
  const serverSearch = search && marketSearch ? undefined : search ?? marketSearch ?? undefined;
  const base: AdminPhotoArchiveFilters = {
    dateFrom: dateFrom ?? undefined,
    dateTo: dateTo ?? undefined,
    campaignId: resolvedCampaignIds.length === 1 ? resolvedCampaignIds[0] : undefined,
    gmUserId: resolvedGmIds.length === 1 ? resolvedGmIds[0] : undefined,
    marketId: marketIds.length === 1 ? marketIds[0] : undefined,
    region: regions.length === 1 ? regions[0] : undefined,
    campaignType: sections.length === 1 ? sections[0] : undefined,
    search: serverSearch,
    pageSize: PHOTO_PAGE_SIZE,
  };
  const all: AdminPhotoArchiveItem[] = [];
  for (let page = 1; page <= MAX_PHOTO_PAGES; page += 1) {
    const payload = await fetchAdminPhotos({ ...base, page });
    all.push(...payload.photos);
    if (all.length >= payload.total || payload.photos.length < PHOTO_PAGE_SIZE) break;
    if (page === MAX_PHOTO_PAGES) {
      throw new Error("Der Fotoarchiv-Export ist zu groß. Bitte Zeitraum oder Filter weiter eingrenzen.");
    }
  }
  const uniquePhotos = Array.from(new Map(all.map((photo) => [photo.id, photo])).values());
  return uniquePhotos.filter((photo) => photoMatchesClientFilters(photo, exportSpec, resolvedGmIds, resolvedCampaignIds));
}

function assertHasRows(count: number): void {
  if (count === 0) throw new Error("Für diese Filter wurden keine exportierbaren Daten gefunden.");
}

export function describeAdminKurtiExcelExport(exportSpec: AdminKurtiExcelExport): string[] {
  const filters = exportSpec.filters;
  const rows: string[] = [];
  if (filters.dateFrom && filters.dateTo) rows.push(`${formatDate(filters.dateFrom)} - ${formatDate(filters.dateTo)}`);
  if (filters.gmNames.length) rows.push(`${filters.gmNames.length} GM-Filter`);
  if (filters.campaignNames.length) rows.push(`${filters.campaignNames.length} Kampagnen-Filter`);
  if (filters.marketSearch) rows.push(`Markt: ${filters.marketSearch}`);
  if (filters.regions.length) rows.push(filters.regions.join(", "));
  if (filters.sections.length) rows.push(filters.sections.join(", "));
  if (filters.search) rows.push(`Suche: ${filters.search}`);
  return rows.slice(0, 3);
}

export async function runAdminKurtiExcelExport(exportSpec: AdminKurtiExcelExport): Promise<void> {
  switch (exportSpec.kind) {
    case "zeiterfassung": {
      const range = buildRange(exportSpec);
      const gmIds = await resolveRequestedGmIds(exportSpec);
      const payload = await fetchAdminZeiterfassungDays({
        from: range.from,
        to: range.to,
        gmUserIds: gmIds.length > 0 ? gmIds : undefined,
        includeLive: exportSpec.filters.includeLive,
        timezone: TIMEZONE,
      });
      const sessions = filterTimeSessions(payload.sessions, exportSpec, gmIds);
      assertHasRows(sessions.length);
      const { exportAdminZeiterfassung } = await import("@/lib/exports/zeiterfassungExport");
      await exportAdminZeiterfassung({ sessions, range, timezone: payload.meta.timezone || TIMEZONE });
      return;
    }
    case "zeitenaufstellung": {
      const range = buildRange(exportSpec);
      const [payload, gms] = await Promise.all([
        fetchAdminZeitenaufstellungExport({ from: range.from, to: range.to, timezone: TIMEZONE }),
        exportSpec.filters.gmUserIds.length > 0 ? fetchGmUsers() : Promise.resolve([] as GMRecord[]),
      ]);
      const resolvedGmNames = unique([
        ...exportSpec.filters.gmNames,
        ...gms
          .filter((gm) => exportSpec.filters.gmUserIds.includes(gm.id))
          .map((gm) => `${gm.firstName} ${gm.lastName}`),
      ]);
      const rows = filterZeitenaufstellungRows(payload.rows, exportSpec, resolvedGmNames);
      assertHasRows(rows.length);
      const { exportAdminZeitenaufstellung } = await import("@/lib/exports/zeitenaufstellungExport");
      await exportAdminZeitenaufstellung({ rows, range });
      return;
    }
    case "diaeten": {
      const range = buildRange(exportSpec);
      const [payload, gmIds] = await Promise.all([
        fetchAdminDiaetenExport({ from: range.from, to: range.to, timezone: TIMEZONE }),
        resolveRequestedGmIds(exportSpec),
      ]);
      const gls = payload.gls.filter((gm) => {
        const name = `${gm.firstName} ${gm.lastName}`;
        return matchesIdentity(gm.gmId, name, gmIds, exportSpec.filters.gmNames)
          && matchesSearch(name, exportSpec.filters.search);
      });
      assertHasRows(gls.length);
      const { exportAdminDiaeten } = await import("@/lib/exports/diaetenExport");
      await exportAdminDiaeten({ ...payload, gls });
      return;
    }
    case "maerkte": {
      const allMarkets = await fetchMarkets();
      const markets = filterMarkets(allMarkets, exportSpec);
      assertHasRows(markets.length);
      const { exportMarketsExcel } = await import("@/lib/exports/masterDataExports");
      await exportMarketsExcel({ markets, allMarketCount: allMarkets.length, filterLabel: exportSpec.title, exportedBy: exportedBy() });
      return;
    }
    case "gebietsmanager": {
      const gms = filterGms(await fetchGmUsers(), exportSpec);
      assertHasRows(gms.length);
      const { exportGebietsmanagerExcel } = await import("@/lib/exports/masterDataExports");
      await exportGebietsmanagerExcel({ gms, exportedBy: exportedBy() });
      return;
    }
    case "shelf_merchandiser": {
      const sms = filterSms(await fetchSmUsers(), exportSpec);
      assertHasRows(sms.length);
      const { exportShelfMerchandiserExcel } = await import("@/lib/exports/masterDataExports");
      await exportShelfMerchandiserExcel({ sms, exportedBy: exportedBy() });
      return;
    }
    case "lager": {
      const [allLagers, gms, gmIds] = await Promise.all([fetchAdminLager(), fetchGmUsers(), resolveRequestedGmIds(exportSpec)]);
      const lagers = filterLagers(allLagers, gms, exportSpec, gmIds);
      assertHasRows(lagers.length);
      const { exportLagerExcel } = await import("@/lib/exports/masterDataExports");
      await exportLagerExcel({ lagers, gms, exportedBy: exportedBy() });
      return;
    }
    case "fragebogen_standard":
    case "fragebogen_flex":
    case "fragebogen_billa":
    case "fragebogen_kuehler":
    case "fragebogen_mhd":
    case "fragebogen_durcharbeit": {
      const section = getQuestionnaireSection(exportSpec.kind);
      const scope = getQuestionnaireScope(section);
      const [allModules, allFragebogen, campaigns] = await Promise.all([
        fetchModules(scope),
        fetchFragebogen(scope),
        fetchCampaigns(),
      ]);
      const filtered = filterQuestionnaireData(allModules, allFragebogen, campaigns, exportSpec, section);
      assertHasRows(filtered.modules.length + filtered.fragebogen.length);
      const { exportFragebogenExcel } = await import("@/lib/exports/planningExports");
      await exportFragebogenExcel({
        modules: filtered.modules,
        fragebogen: filtered.fragebogen,
        campaignUsageByFragebogenId: filtered.usage,
        primaryScope: section,
        title: exportSpec.title,
        exportedBy: exportedBy(),
      });
      return;
    }
    case "fotoarchiv": {
      const photos = await fetchAllFilteredPhotos(exportSpec);
      assertHasRows(photos.length);
      const { exportFotoarchivExcel } = await import("@/lib/exports/analysisExports");
      await exportFotoarchivExcel({ photos, total: photos.length, filters: {
        dateFrom: exportSpec.filters.dateFrom ?? undefined,
        dateTo: exportSpec.filters.dateTo ?? undefined,
        search: exportSpec.filters.search ?? exportSpec.filters.marketSearch ?? undefined,
      }, exportedBy: exportedBy() });
      return;
    }
    default: {
      const exhaustive: never = exportSpec.kind;
      throw new Error(`Nicht unterstützter Export: ${exhaustive}`);
    }
  }
}
