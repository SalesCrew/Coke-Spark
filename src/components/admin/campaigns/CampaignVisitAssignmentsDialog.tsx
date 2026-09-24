"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import type { Campaign, CampaignMarketAssignment } from "@/types/campaign";
import type { GMRecord } from "@/types/gebietsmanager";

export type CampaignVisitMarket = {
  id: string;
  name: string;
  chain: string;
  address: string;
  postalCode?: string;
  city: string;
  region: string;
  flexNumber?: string;
  standardMarketNumber?: string;
  cokeMasterNumber?: string;
  kuehlerStammnr?: string;
  dbName?: string;
  emEh?: string;
  employee?: string;
  currentGmName?: string;
  visitFrequencyPerYear?: number;
  marketType?: string;
  universeMarket?: boolean;
  isActive?: boolean;
  infoFlag?: boolean;
  infoNote?: string;
  ipp?: number | null;
  importSourceFileName?: string;
  importedAt?: string;
};

type VisitRow = {
  key: string;
  assignment: CampaignMarketAssignment;
  visitNumber: number;
  market: CampaignVisitMarket;
  isKuehler: boolean;
  isFlex: boolean;
};
type FieldKey = "market" | "marketId" | "chain" | "dbName" | "address" | "postalCode" | "city" | "region" | "flexNumber" | "standardMarketNumber" | "cokeMasterNumber" | "kuehlerStammnr" | "gm" | "gmUserId" | "currentGmName" | "emEh" | "employee" | "visitFrequencyPerYear" | "marketType" | "universeMarket" | "isActive" | "infoFlag" | "infoNote" | "ipp" | "importSourceFileName" | "importedAt" | "assignmentId" | "slot" | "visit" | "status";
type FieldFilter = { id: number; field: FieldKey; value: string };
type VisitProgress = {
  completedByAssignmentId: Record<string, number>;
  startedByAssignmentId: Record<string, number>;
};

const PAGE_SIZE = 100;
const FIELD_OPTIONS: Array<{ key: FieldKey; label: string }> = [
  { key: "market", label: "Markt" }, { key: "marketId", label: "Markt-ID" }, { key: "chain", label: "Kette" }, { key: "dbName", label: "DB-Name" },
  { key: "address", label: "Adresse" }, { key: "postalCode", label: "PLZ" },
  { key: "city", label: "Ort" }, { key: "region", label: "Region" },
  { key: "flexNumber", label: "Flex-Nr." }, { key: "standardMarketNumber", label: "Standardmarkt-Nr." },
  { key: "cokeMasterNumber", label: "Stamm-Nr." }, { key: "kuehlerStammnr", label: "Kühler-Stammnr." },
  { key: "gm", label: "Geplanter GM" }, { key: "gmUserId", label: "GM-ID" }, { key: "currentGmName", label: "Markt-GM" }, { key: "emEh", label: "EM/EH" },
  { key: "employee", label: "Mitarbeiter" }, { key: "visitFrequencyPerYear", label: "Frequenz/Jahr" },
  { key: "marketType", label: "Markttyp" }, { key: "universeMarket", label: "Universum" },
  { key: "isActive", label: "Markt aktiv" }, { key: "infoFlag", label: "Infoflag" }, { key: "infoNote", label: "Info-Notiz" },
  { key: "ipp", label: "IPP" }, { key: "importSourceFileName", label: "Importdatei" }, { key: "importedAt", label: "Importzeit" },
  { key: "assignmentId", label: "Zuweisungs-ID" }, { key: "slot", label: "Slot" }, { key: "visit", label: "Besuch" }, { key: "status", label: "Besuchsstatus" },
];
const fieldLabel = (key: FieldKey) => FIELD_OPTIONS.find((entry) => entry.key === key)?.label ?? key;
const gmName = (gm: GMRecord) => `${gm.firstName ?? ""} ${gm.lastName ?? ""}`.trim() || gm.email;
const normal = (value: string) => value.toLocaleLowerCase("de-AT").trim();

function fieldValue(row: VisitRow, field: FieldKey, progress?: VisitProgress | null): string {
  switch (field) {
    case "market": return row.market.name;
    case "marketId": return row.market.id;
    case "chain": return row.market.chain;
    case "dbName": return row.market.dbName ?? "";
    case "address": return row.market.address;
    case "postalCode": return row.market.postalCode ?? "";
    case "city": return row.market.city;
    case "region": return row.market.region;
    case "flexNumber": return row.market.flexNumber ?? "";
    case "standardMarketNumber": return row.market.standardMarketNumber ?? "";
    case "cokeMasterNumber": return row.market.cokeMasterNumber ?? "";
    case "kuehlerStammnr": return row.market.kuehlerStammnr ?? "";
    case "currentGmName": return row.market.currentGmName ?? "";
    case "emEh": return row.market.emEh ?? "";
    case "employee": return row.market.employee ?? "";
    case "visitFrequencyPerYear": return String(row.market.visitFrequencyPerYear ?? "");
    case "marketType": return row.market.marketType ?? "";
    case "universeMarket": return row.market.universeMarket === undefined ? "" : row.market.universeMarket ? "Ja" : "Nein";
    case "isActive": return row.market.isActive === undefined ? "" : row.market.isActive ? "Ja" : "Nein";
    case "infoFlag": return row.market.infoFlag === undefined ? "" : row.market.infoFlag ? "Ja" : "Nein";
    case "infoNote": return row.market.infoNote ?? "";
    case "ipp": return String(row.market.ipp ?? "");
    case "importSourceFileName": return row.market.importSourceFileName ?? "";
    case "importedAt": return row.market.importedAt ?? "";
    case "gm": return row.assignment.gmName ?? "Nicht zugewiesen";
    case "gmUserId": return row.assignment.gmUserId ?? "";
    case "assignmentId": return row.assignment.id;
    case "slot": return String(row.assignment.assignmentSlot);
    case "visit": return String(row.visitNumber);
    case "status": {
      if (!progress || row.isFlex) return "";
      const completed = progress.completedByAssignmentId[row.assignment.id] ?? 0;
      const started = progress.startedByAssignmentId[row.assignment.id] ?? 0;
      if (row.isKuehler) {
        if (completed >= row.assignment.visitTargetCount) return "Erledigt";
        return completed > 0 || started > 0 ? "In Bearbeitung" : "Offen";
      }
      if (row.visitNumber <= completed) return "Erledigt";
      return row.visitNumber <= completed + started ? "In Bearbeitung" : "Offen";
    }
  }
}

function buildRows(campaign: Campaign, markets: CampaignVisitMarket[]): VisitRow[] {
  const byId = new Map(markets.map((market) => [market.id, market]));
  return campaign.assignments.flatMap((assignment) => {
    const displayAssignment = campaign.section === "flex"
      ? { ...assignment, gmUserId: campaign.assignedGmUserId ?? null, gmName: campaign.assignedGmName ?? "Alle GM" }
      : assignment;
    const market = byId.get(assignment.marketId) ?? {
      id: assignment.marketId, name: "Markt wird geladen…", chain: "", address: "", city: "", region: "",
    };
    const rowCount = campaign.section === "kuehler" ? 1 : assignment.visitTargetCount;
    return Array.from({ length: rowCount }, (_, index) => ({
      key: `${assignment.id}:${index + 1}`,
      assignment: displayAssignment,
      visitNumber: index + 1,
      market,
      isKuehler: campaign.section === "kuehler",
      isFlex: campaign.section === "flex",
    }));
  }).sort((a, b) => a.market.name.localeCompare(b.market.name, "de-AT")
    || a.assignment.assignmentSlot - b.assignment.assignmentSlot
    || a.visitNumber - b.visitNumber
    || (a.assignment.gmName ?? "").localeCompare(b.assignment.gmName ?? "", "de-AT"));
}

export function CampaignVisitAssignmentsDialog({ campaign, markets, marketsLoading, marketsError, onRetryMarkets, gmUsers, gmUsersLoading, gmUsersError, loadVisitProgress, onClose, onSaveVisit, onReassigned }: {
  campaign: Campaign;
  markets: CampaignVisitMarket[];
  marketsLoading: boolean;
  marketsError: string | null;
  onRetryMarkets: () => void;
  gmUsers: GMRecord[];
  gmUsersLoading: boolean;
  gmUsersError: string | null;
  loadVisitProgress: (campaignId: string) => Promise<VisitProgress>;
  onClose: () => void;
  onSaveVisit: (assignmentId: string, input: { toGmUserId: string; expectedGmUserId: string | null; expectedVisitTargetCount: number; visitNumber: number }) => Promise<Campaign>;
  onReassigned: (campaign: Campaign) => void;
}) {
  const [search, setSearch] = useState("");
  const [gmFilter, setGmFilter] = useState("");
  const [regionFilter, setRegionFilter] = useState("");
  const [chainFilter, setChainFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [filterField, setFilterField] = useState<FieldKey>("flexNumber");
  const [filterValue, setFilterValue] = useState("");
  const [fieldFilters, setFieldFilters] = useState<FieldFilter[]>([]);
  const [page, setPage] = useState(0);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [gmSearch, setGmSearch] = useState("");
  const [nextGmId, setNextGmId] = useState("");
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const editingPanelRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [visitProgress, setVisitProgress] = useState<VisitProgress | null>(null);
  const [completionError, setCompletionError] = useState<string | null>(null);
  const [completionRefresh, setCompletionRefresh] = useState(0);
  const reassignmentUnavailable = campaign.section === "flex"
    ? "Flex ist global oder kampagnenweit zugeordnet. Deshalb gibt es hier keine GM-Umplanung pro einzelnem Besuch."
    : null;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape" && !savingKey) onClose(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, savingKey]);

  useEffect(() => {
    if (reassignmentUnavailable) return;
    let active = true;
    loadVisitProgress(campaign.id)
      .then((progress) => { if (active) { setVisitProgress(progress); setCompletionError(null); } })
      .catch((cause) => { if (active) { setVisitProgress(null); setCompletionError(cause instanceof Error ? cause.message : "Besuchsstatus konnte nicht geladen werden."); } });
    return () => { active = false; };
  }, [campaign.id, loadVisitProgress, completionRefresh, reassignmentUnavailable]);

  useEffect(() => {
    if (!editingKey) return;
    const frame = requestAnimationFrame(() => editingPanelRef.current?.scrollIntoView({ block: "nearest" }));
    return () => cancelAnimationFrame(frame);
  }, [editingKey]);

  const rows = useMemo(() => buildRows(campaign, markets), [campaign, markets]);
  const options = useMemo(() => {
    const unique = (values: string[]) => Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b, "de-AT"));
    return {
      gms: unique(rows.map((row) => fieldValue(row, "gm"))),
      regions: unique(rows.map((row) => row.market.region)),
      chains: unique(rows.map((row) => row.market.chain)),
      cities: unique(rows.map((row) => row.market.city)),
    };
  }, [rows]);
  const filteredRows = useMemo(() => {
    const needle = normal(search);
    return rows.filter((row) => {
      if (gmFilter && fieldValue(row, "gm") !== gmFilter) return false;
      if (regionFilter && row.market.region !== regionFilter) return false;
      if (chainFilter && row.market.chain !== chainFilter) return false;
      if (cityFilter && row.market.city !== cityFilter) return false;
      if (statusFilter && fieldValue(row, "status", visitProgress) !== statusFilter) return false;
      if (fieldFilters.some((filter) => !normal(fieldValue(row, filter.field, visitProgress)).includes(normal(filter.value)))) return false;
      return !needle || FIELD_OPTIONS.some((field) => normal(fieldValue(row, field.key, visitProgress)).includes(needle))
        || normal(row.market.id).includes(needle);
    });
  }, [rows, search, gmFilter, regionFilter, chainFilter, cityFilter, statusFilter, fieldFilters, visitProgress]);
  const pageCount = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const visibleRows = filteredRows.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  const activeFilterCount = [gmFilter, regionFilter, chainFilter, cityFilter, statusFilter].filter(Boolean).length + fieldFilters.length;
  const sortedGms = useMemo(() => gmUsers.filter((gm) => gm.isActive !== false)
    .sort((a, b) => gmName(a).localeCompare(gmName(b), "de-AT")), [gmUsers]);

  const resetPage = () => { setPage(0); setEditingKey(null); setError(null); };
  const startEditing = (row: VisitRow) => {
    setEditingKey(row.key);
    setNextGmId(row.assignment.gmUserId ?? "");
    setGmSearch("");
    setError(null);
  };
  const save = async (row: VisitRow) => {
    if (!nextGmId || nextGmId === row.assignment.gmUserId || savingKey) return;
    setSavingKey(row.key);
    setError(null);
    try {
      const updated = await onSaveVisit(row.assignment.id, {
        toGmUserId: nextGmId,
        expectedGmUserId: row.assignment.gmUserId,
        expectedVisitTargetCount: row.assignment.visitTargetCount,
        visitNumber: row.visitNumber,
      });
      onReassigned(updated);
      setEditingKey(null);
      setVisitProgress(null);
      setCompletionRefresh((current) => current + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Der Besuch konnte nicht umgeplant werden.");
    } finally {
      setSavingKey(null);
    }
  };

  return <div role="presentation" className="fixed inset-0 z-[10000] flex items-center justify-center bg-[#17212a]/45 p-3 backdrop-blur-[3px] sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget && !savingKey) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-labelledby="campaign-visits-title" className="flex max-h-[min(92dvh,980px)] w-full max-w-[1120px] flex-col overflow-hidden rounded-2xl border border-black/10 bg-white shadow-[0_24px_80px_rgba(0,0,0,.22)]">
      <header className="flex items-start justify-between gap-5 border-b border-black/[.06] px-5 py-4 sm:px-7">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[.12em] text-red-600">GM · Kampagnen</p>
          <h2 id="campaign-visits-title" className="mt-1 truncate text-xl font-bold tracking-[-.025em] text-[#1a1a1a]">Besuchsplanung · {campaign.name}</h2>
          <p className="mt-1 text-xs text-black/45">{rows.length.toLocaleString("de-AT")} {campaign.section === "kuehler" ? "Planungs-Slots" : "geplante Besuche"} · {reassignmentUnavailable ? "Übersicht" : "GM pro Besuch ändern"}</p>
        </div>
        <button type="button" onClick={onClose} disabled={Boolean(savingKey)} aria-label="Besuchsplanung schließen" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-black/10 text-black/45 hover:bg-black/[.04] disabled:opacity-40"><X size={16} /></button>
      </header>

      <div className="space-y-3 border-b border-black/[.06] bg-[#fafafa] px-5 py-4 sm:px-7">
        <label className="flex h-9 items-center gap-2 rounded-lg border border-black/10 bg-white px-3 focus-within:border-red-300">
          <Search size={14} className="text-black/35" />
          <input aria-label="Alle Besuchsdaten durchsuchen" value={search} onChange={(event) => { setSearch(event.target.value); resetPage(); }} placeholder="Markt, Adresse, Nummer, Ort oder GM suchen…" className="min-w-0 flex-1 bg-transparent text-xs text-[#1a1a1a] outline-none placeholder:text-black/30" />
          {search ? <button type="button" onClick={() => { setSearch(""); resetPage(); }} aria-label="Suche löschen" className="text-black/35"><X size={13} /></button> : null}
        </label>
        <div className="flex flex-wrap gap-2">
          {([
            ["GM", gmFilter, setGmFilter, options.gms], ["Region", regionFilter, setRegionFilter, options.regions],
            ["Kette", chainFilter, setChainFilter, options.chains], ["Ort", cityFilter, setCityFilter, options.cities],
          ] as const).map(([label, value, setter, values]) => <select key={label} aria-label={`${label} filtern`} value={value} onChange={(event) => { setter(event.target.value); resetPage(); }} className="h-8 max-w-[190px] rounded-lg border border-black/10 bg-white px-2 text-[11px] font-medium text-black/65 outline-none focus:border-red-300">
            <option value="">{label}: Alle</option>{values.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>)}
          {!reassignmentUnavailable ? <select aria-label="Besuchsstatus filtern" value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); resetPage(); }} className="h-8 max-w-[190px] rounded-lg border border-black/10 bg-white px-2 text-[11px] font-medium text-black/65 outline-none focus:border-red-300">
            <option value="">Status: Alle</option><option value="Offen">Offen</option><option value="In Bearbeitung">In Bearbeitung</option><option value="Erledigt">Erledigt</option>
          </select> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-semibold text-black/40">Weiteres Feld</span>
          <select aria-label="Datenfeld wählen" value={filterField} onChange={(event) => setFilterField(event.target.value as FieldKey)} className="h-8 rounded-lg border border-black/10 bg-white px-2 text-[11px] text-black/65 outline-none focus:border-red-300">
            {FIELD_OPTIONS.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
          </select>
          <input aria-label="Filterwert" value={filterValue} onChange={(event) => setFilterValue(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && filterValue.trim()) { setFieldFilters((current) => [...current, { id: Date.now(), field: filterField, value: filterValue.trim() }]); setFilterValue(""); resetPage(); } }} placeholder="Enthält…" className="h-8 w-36 rounded-lg border border-black/10 bg-white px-2 text-[11px] text-black/65 outline-none placeholder:text-black/30 focus:border-red-300" />
          <button type="button" disabled={!filterValue.trim()} onClick={() => { setFieldFilters((current) => [...current, { id: Date.now(), field: filterField, value: filterValue.trim() }]); setFilterValue(""); resetPage(); }} className="h-8 rounded-lg border border-black/10 bg-white px-3 text-[11px] font-semibold text-black/60 hover:bg-black/[.03] disabled:opacity-40">+ Filter</button>
          {activeFilterCount > 0 ? <button type="button" onClick={() => { setGmFilter(""); setRegionFilter(""); setChainFilter(""); setCityFilter(""); setStatusFilter(""); setFieldFilters([]); resetPage(); }} className="text-[11px] font-semibold text-red-600">Zurücksetzen</button> : null}
        </div>
        {fieldFilters.length > 0 ? <div className="flex flex-wrap gap-1.5">{fieldFilters.map((filter) => <button key={filter.id} type="button" onClick={() => { setFieldFilters((current) => current.filter((item) => item.id !== filter.id)); resetPage(); }} className="flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-[10px] font-semibold text-red-700">{fieldLabel(filter.field)}: {filter.value}<X size={11} /></button>)}</div> : null}
      </div>

      {reassignmentUnavailable ? <div className="mx-5 mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 sm:mx-7">{reassignmentUnavailable}</div> : null}
      {marketsError ? <div role="alert" className="mx-5 mt-3 flex items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 sm:mx-7"><span>{marketsError}</span><button type="button" onClick={onRetryMarkets} className="shrink-0 font-bold underline">Erneut laden</button></div> : null}
      {completionError ? <div role="alert" className="mx-5 mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 sm:mx-7">{completionError} Bitte später erneut öffnen.</div> : null}
      {error ? <div role="alert" className="mx-5 mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 sm:mx-7">{error}</div> : null}
      <div className="flex items-center justify-between px-5 py-2.5 text-[11px] text-black/45 sm:px-7"><span>{filteredRows.length.toLocaleString("de-AT")} von {rows.length.toLocaleString("de-AT")} {campaign.section === "kuehler" ? "Slots" : "Besuchen"}</span><span>{marketsLoading ? "Marktdaten laden…" : reassignmentUnavailable ? "Globale Flex-Zuordnung" : visitProgress === null && !completionError ? "Besuchsstatus lädt…" : "Begonnene und eingereichte Besuche bleiben beim bisherigen GM."}</span></div>
      <div className="min-h-0 flex-1 overflow-auto px-5 pb-3 sm:px-7">
        <div className="min-w-0 overflow-hidden rounded-xl border border-black/[.08] md:min-w-[820px]">
          <div className="hidden grid-cols-[minmax(210px,2.2fr)_minmax(150px,1.5fr)_110px_110px_minmax(170px,1.3fr)] gap-3 border-b border-black/[.08] bg-[#f8f8f8] px-4 py-2.5 text-[9px] font-bold uppercase tracking-[.08em] text-black/35 md:grid"><span>Markt</span><span>Adresse</span><span>Region</span><span>{campaign.section === "kuehler" ? "Ziel" : "Besuch"}</span><span>Geplanter GM</span></div>
          {visibleRows.length === 0 ? <div className="px-4 py-10 text-center text-xs text-black/40">{statusFilter && !visitProgress && !completionError ? "Besuchsstatus lädt…" : "Keine Besuche für diese Filter gefunden."}</div> : visibleRows.map((row) => {
            const editing = editingKey === row.key;
            const visitStatus = fieldValue(row, "status", visitProgress);
            const completed = visitStatus === "Erledigt";
            const started = visitStatus === "In Bearbeitung";
            const selectedGm = sortedGms.find((gm) => gm.id === nextGmId);
            return <div key={row.key} className="border-b border-black/[.05] last:border-b-0">
              <div className="grid grid-cols-2 items-center gap-x-3 gap-y-2 px-4 py-3 text-[11px] text-black/65 hover:bg-black/[.012] md:grid-cols-[minmax(210px,2.2fr)_minmax(150px,1.5fr)_110px_110px_minmax(170px,1.3fr)]">
                <div className="col-span-2 min-w-0 md:col-span-1"><div className="truncate font-semibold text-[#1a1a1a]" title={row.market.name}>{row.market.name}</div><div className="mt-1 truncate text-[10px] text-black/35">{[row.market.flexNumber && `Flex ${row.market.flexNumber}`, row.market.cokeMasterNumber && `Stamm ${row.market.cokeMasterNumber}`, row.market.standardMarketNumber && `Standard ${row.market.standardMarketNumber}`].filter(Boolean).join(" · ") || row.market.chain || row.market.id}</div></div>
                <span className="col-span-2 min-w-0 truncate text-[10px] md:col-span-1 md:text-[11px]" title={`${row.market.address}, ${row.market.postalCode ?? ""} ${row.market.city}`}>{row.market.address}<br className="hidden md:block" /><span className="text-black/40 md:text-[10px]"> · {row.market.postalCode} {row.market.city}</span></span>
                <span className="min-w-0 truncate" title={row.market.region}><span className="mr-1 text-[9px] font-bold uppercase tracking-wide text-black/30 md:hidden">Region</span>{row.market.region || "—"}</span>
                <span className="tabular-nums"><span className="mr-1 text-[9px] font-bold uppercase tracking-wide text-black/30 md:hidden">{campaign.section === "kuehler" ? "Ziel" : "Besuch"}</span>{campaign.section === "kuehler" ? `${row.assignment.visitTargetCount} ${row.assignment.visitTargetCount === 1 ? "Gerät" : "Geräte"}` : `${row.visitNumber}/${row.assignment.visitTargetCount}`}<span className="block text-[10px] text-black/35">Slot {row.assignment.assignmentSlot}{visitStatus ? ` · ${visitStatus.toLocaleLowerCase("de-AT")}` : ""}</span></span>
                <button type="button" disabled={Boolean(savingKey) || completed || started || Boolean(reassignmentUnavailable) || visitProgress === null || marketsLoading || Boolean(marketsError)} onClick={() => editing ? setEditingKey(null) : startEditing(row)} title={reassignmentUnavailable ?? (completed ? "Bereits erledigte Besuche können nicht umgeplant werden." : started ? "Begonnene Besuche können nicht umgeplant werden." : "GM für diesen Besuch ändern")} className="col-span-2 flex min-w-0 items-center justify-between gap-1 rounded-lg border border-black/10 bg-white px-2.5 py-2 text-left text-[11px] font-semibold text-[#1a1a1a] hover:border-red-200 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-45 md:col-span-1"><span className="truncate"><span className="mr-1 text-[9px] font-bold uppercase tracking-wide text-black/30 md:hidden">GM</span>{row.assignment.gmName || (campaign.section === "flex" ? campaign.assignedGmName : null) || "GM zuweisen"}</span><ChevronRight size={13} className="shrink-0" /></button>
              </div>
              {editing ? <div ref={editingPanelRef} className="border-t border-red-100 bg-red-50/40 px-4 py-3">
                <div className="flex flex-wrap items-center gap-2"><span className="text-[11px] font-semibold text-black/55">GM für diesen Besuch ändern:</span><input aria-label="GM suchen" value={gmSearch} onChange={(event) => setGmSearch(event.target.value)} placeholder="GM suchen…" className="h-8 min-w-[160px] flex-1 rounded-lg border border-black/10 bg-white px-2 text-[11px] outline-none focus:border-red-300" /></div>
                <div className="mt-2 max-h-36 overflow-auto rounded-lg border border-black/[.08] bg-white p-1">{gmUsersLoading ? <p className="p-2 text-[11px] text-black/45">GM werden geladen…</p> : gmUsersError ? <p className="p-2 text-[11px] text-red-600">{gmUsersError}</p> : sortedGms.filter((gm) => normal(gmName(gm)).includes(normal(gmSearch))).map((gm) => <button key={gm.id} type="button" onClick={() => setNextGmId(gm.id)} className={`flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-[11px] ${nextGmId === gm.id ? "bg-red-50 font-semibold text-red-700" : "text-black/65 hover:bg-black/[.03]"}`}>{gmName(gm)}{nextGmId === gm.id ? <Check size={13} /> : null}</button>)}</div>
                <div className="mt-2 flex items-center justify-end gap-2"><span className="mr-auto text-[10px] text-black/45">{selectedGm ? `Neu: ${gmName(selectedGm)}` : "Bitte einen aktiven GM wählen."}</span><button type="button" onClick={() => setEditingKey(null)} disabled={Boolean(savingKey)} className="rounded-lg border border-black/10 bg-white px-3 py-1.5 text-[11px] font-semibold text-black/55">Abbrechen</button><button type="button" disabled={!nextGmId || nextGmId === row.assignment.gmUserId || Boolean(savingKey)} onClick={() => void save(row)} className="rounded-lg bg-red-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-red-700 disabled:opacity-40">{savingKey ? "Speichern…" : row.isKuehler ? "Kühler-Besuch umplanen" : "1 Besuch umplanen"}</button></div>
              </div> : null}
            </div>;
          })}
        </div>
      </div>
      <footer className="flex items-center justify-between border-t border-black/[.06] px-5 py-3 sm:px-7"><span className="text-[11px] text-black/40">Seite {currentPage + 1} / {pageCount}</span><div className="flex gap-2"><button type="button" disabled={currentPage === 0} onClick={() => { setPage(currentPage - 1); setEditingKey(null); }} aria-label="Vorherige Seite" className="flex h-8 w-8 items-center justify-center rounded-lg border border-black/10 disabled:opacity-35"><ChevronLeft size={15} /></button><button type="button" disabled={currentPage >= pageCount - 1} onClick={() => { setPage(currentPage + 1); setEditingKey(null); }} aria-label="Nächste Seite" className="flex h-8 w-8 items-center justify-center rounded-lg border border-black/10 disabled:opacity-35"><ChevronRight size={15} /></button></div></footer>
    </section>
  </div>;
}
