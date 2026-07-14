"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, X, CheckCircle2, Circle } from "lucide-react";
import {
  fetchActiveGmVisitSession,
  fetchCurrentDaySession,
  fetchGmKuehlerMhdProgress,
  fetchGmMarketDetail,
  fetchGmVisitSession,
  fetchGmVisitStartPayload,
  fetchLatestActiveGmVisitSession,
  setGmVisitPreloadCache,
  setGmVisitStartPreloadCache,
  type DaySessionCurrentPayload,
  type GmKuehlerMhdProgressPayload,
  type GmMarketDetailPayload,
  type GmVisitSessionPayload,
} from "@/lib/api/backend";
import {
  isLocalDaySessionSnapshotUsableForStartGate,
  readLatestLocalDaySessionSnapshot,
} from "@/lib/gm/daySessionPersistence";
import { ActiveFragebogenBlockModal } from "./ActiveFragebogenBlockModal";
import {
  GmMarketDetailModal,
  toMarketListEntry,
  type GmMarketDetailCampaignChoice,
  type GmDashboardMarket,
} from "./MarketList";
import { GmSkeletonMarketRows } from "./GmDashboardSkeleton";
import { DashboardGateOverlay } from "./DashboardLockOverlay";

interface KuehlerMarket {
  marketId?: string;
  campaignId?: string;
  campaignName?: string;
  kuehlerUnitId?: string | null;
  kuehlerNumber?: string | null;
  chain: string;
  address: string;
  stammnr?: string | null;
  done: boolean;
  doneDate?: string;
}

const defaultKuehlerMarkets: KuehlerMarket[] = [
  { chain: "BILLA+", address: "Hauptstraße 12, 1010 Wien", done: true, doneDate: "12.01.2026" },
  { chain: "SPAR", address: "Mariahilfer Str. 88, 1060 Wien", done: true, doneDate: "15.01.2026" },
  { chain: "ADEG", address: "Landstraße 45, 1030 Wien", done: true, doneDate: "18.01.2026" },
  { chain: "BILLA+", address: "Favoritenstr. 22, 1100 Wien", done: true, doneDate: "22.01.2026" },
  { chain: "HOFER", address: "Gudrunstraße 18, 1100 Wien", done: true, doneDate: "25.01.2026" },
  { chain: "PENNY", address: "Simmeringer Hptstr. 5, 1110 Wien", done: true, doneDate: "28.01.2026" },
  { chain: "SPAR", address: "Laxenburger Str. 67, 1100 Wien", done: true, doneDate: "02.02.2026" },
  { chain: "ADEG", address: "Brünner Str. 130, 1210 Wien", done: true, doneDate: "05.02.2026" },
  { chain: "BILLA+", address: "Thaliastraße 90, 1160 Wien", done: true, doneDate: "08.02.2026" },
  { chain: "SPAR", address: "Hütteldorfer Str. 130, 1140 Wien", done: true, doneDate: "10.02.2026" },
  { chain: "PENNY", address: "Ottakringer Str. 44, 1170 Wien", done: false },
  { chain: "ADEG", address: "Hernalser Hauptstr. 77, 1170 Wien", done: false },
  { chain: "BILLA+", address: "Wiedner Hauptstr. 56, 1040 Wien", done: false },
  { chain: "HOFER", address: "Johnstraße 42, 1150 Wien", done: false },
  { chain: "SPAR", address: "Döblinger Hauptstr. 2, 1190 Wien", done: false },
  { chain: "BILLA+", address: "Prater Str. 31, 1020 Wien", done: false },
  { chain: "ADEG", address: "Grinzinger Allee 5, 1190 Wien", done: false },
  { chain: "SPAR", address: "Kärntner Str. 22, 1010 Wien", done: false },
  { chain: "HOFER", address: "Triester Str. 64, 1100 Wien", done: false },
  { chain: "PENNY", address: "Heiligenstädter Str. 80, 1190 Wien", done: false },
];

const defaultMhdMarkets: KuehlerMarket[] = [
  { chain: "BILLA+", address: "Hauptstraße 12, 1010 Wien", done: true, doneDate: "14.01.2026" },
  { chain: "SPAR", address: "Mariahilfer Str. 88, 1060 Wien", done: true, doneDate: "16.01.2026" },
  { chain: "HOFER", address: "Gudrunstraße 18, 1100 Wien", done: true, doneDate: "20.01.2026" },
  { chain: "ADEG", address: "Landstraße 45, 1030 Wien", done: true, doneDate: "24.01.2026" },
  { chain: "PENNY", address: "Simmeringer Hptstr. 5, 1110 Wien", done: true, doneDate: "29.01.2026" },
  { chain: "BILLA+", address: "Thaliastraße 90, 1160 Wien", done: true, doneDate: "03.02.2026" },
  { chain: "SPAR", address: "Laxenburger Str. 67, 1100 Wien", done: false },
  { chain: "ADEG", address: "Brünner Str. 130, 1210 Wien", done: false },
  { chain: "PENNY", address: "Ottakringer Str. 44, 1170 Wien", done: false },
  { chain: "HOFER", address: "Johnstraße 42, 1150 Wien", done: false },
  { chain: "BILLA+", address: "Wiedner Hauptstr. 56, 1040 Wien", done: false },
  { chain: "SPAR", address: "Döblinger Hauptstr. 2, 1190 Wien", done: false },
  { chain: "BILLA+", address: "Prater Str. 31, 1020 Wien", done: false },
  { chain: "ADEG", address: "Grinzinger Allee 5, 1190 Wien", done: false },
  { chain: "SPAR", address: "Kärntner Str. 22, 1010 Wien", done: false },
];

function chainColor(chain: string): { bg: string; text: string } {
  const key = chain.toUpperCase();
  if (key.includes("BILLA")) return { bg: "rgba(234,179,8,0.10)", text: "#a16207" };
  if (key.includes("SPAR")) return { bg: "rgba(220,38,38,0.06)", text: "#DC2626" };
  if (key.includes("ADEG")) return { bg: "rgba(34,197,94,0.08)", text: "#15803d" };
  if (key.includes("PENNY")) return { bg: "rgba(194,65,12,0.08)", text: "#c2410c" };
  if (key.includes("HOFER")) return { bg: "rgba(59,130,246,0.08)", text: "#2563eb" };
  return { bg: "rgba(0,0,0,0.04)", text: "#6b7280" };
}

function StammnrValue({ value }: { value?: string | null }) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return null;
  return (
    <span
      className="text-[8px] tabular-nums shrink-0 ml-2"
      style={{ color: "rgba(15,23,42,0.34)", fontWeight: 650, letterSpacing: "0.01em" }}
    >
      {trimmed}
    </span>
  );
}

function KuehlerNumberValue({ value }: { value?: string | null }) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return null;
  return (
    <span
      className="text-[8px] tabular-nums shrink-0 ml-2"
      style={{ color: "rgba(217,119,6,0.82)", fontWeight: 750, letterSpacing: "0.01em" }}
    >
      {trimmed}
    </span>
  );
}

function getKuehlerChoiceKey(entry: Pick<KuehlerMarket, "campaignId" | "kuehlerUnitId" | "kuehlerNumber" | "address">, index = 0) {
  return [
    entry.campaignId ?? "campaign",
    entry.kuehlerUnitId ?? entry.kuehlerNumber ?? entry.address ?? `row-${index}`,
  ].join("__");
}

type Tab = "kuehler" | "mhd";
const DAY_SESSION_UPDATED_EVENT = "gm:day-session-updated";
const TODAY_SUBMISSIONS_UPDATED_EVENT = "gm:today-submissions-updated";
const KUEHLER_MHD_PROGRESS_UPDATED_EVENT = "gm:kuehler-mhd-progress-updated";

interface KuehlerInventurCardProps {
  current?: number;
  total?: number;
  mhdCurrent?: number;
  mhdTotal?: number;
  startDate?: string;
  endDate?: string;
  markets?: KuehlerMarket[];
  mhdMarkets?: KuehlerMarket[];
  activeVisitLocked?: boolean;
  pauseActive?: boolean;
  daySessionPayload?: DaySessionCurrentPayload | null;
  daySessionLoading?: boolean;
  initialProgressData?: GmKuehlerMhdProgressPayload | null;
}

export function KuehlerInventurCard({
  current = 62,
  total = 120,
  mhdCurrent = 6,
  mhdTotal = 15,
  startDate = "01.01.2026",
  endDate = "31.03.2026",
  markets = defaultKuehlerMarkets,
  mhdMarkets = defaultMhdMarkets,
  activeVisitLocked = false,
  pauseActive = false,
  daySessionPayload,
  daySessionLoading = false,
  initialProgressData,
}: KuehlerInventurCardProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("kuehler");
  const [showDetail, setShowDetail] = useState(false);
  const [search, setSearch] = useState("");
  const [progressData, setProgressData] = useState<GmKuehlerMhdProgressPayload | null>(initialProgressData ?? null);
  const [loadingData, setLoadingData] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedMarket, setSelectedMarket] = useState<GmDashboardMarket | null>(null);
  const [marketDetail, setMarketDetail] = useState<GmMarketDetailPayload | null>(null);
  const [marketDetailLoading, setMarketDetailLoading] = useState(false);
  const [marketDetailError, setMarketDetailError] = useState<string | null>(null);
  const [selectedCampaignIds, setSelectedCampaignIds] = useState<string[]>([]);
  const [selectedKuehlerUnitId, setSelectedKuehlerUnitId] = useState<string | null>(null);
  const [dayStarted, setDayStarted] = useState(false);
  const [dayGateLoading, setDayGateLoading] = useState(true);
  const [isLaunching, setIsLaunching] = useState(false);
  const [launchError, setLaunchError] = useState<string | null>(null);
  const [blockedActiveVisit, setBlockedActiveVisit] = useState<GmVisitSessionPayload | null>(null);
  const [blockedActiveOpening, setBlockedActiveOpening] = useState(false);

  // Auto-rotate: switches every 10s, pauses 60s after manual interaction
  const autoRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pauseRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressLoadedAtRef = useRef(initialProgressData ? Date.now() : 0);
  const [paused, setPaused] = useState(false);

  const startAutoRotate = useCallback(() => {
    if (autoRef.current) clearInterval(autoRef.current);
    autoRef.current = setInterval(() => {
      setActiveTab((t) => (t === "kuehler" ? "mhd" : "kuehler"));
    }, 10000);
  }, []);

  useEffect(() => {
    startAutoRotate();
    return () => {
      if (autoRef.current) clearInterval(autoRef.current);
      if (pauseRef.current) clearTimeout(pauseRef.current);
    };
  }, [startAutoRotate]);

  const handleInteraction = useCallback(() => {
    // Pause rotation for 60s on any manual interaction
    setPaused(true);
    if (autoRef.current) clearInterval(autoRef.current);
    if (pauseRef.current) clearTimeout(pauseRef.current);
    pauseRef.current = setTimeout(() => {
      setPaused(false);
      startAutoRotate();
    }, 60000);
  }, [startAutoRotate]);

  const handleTabClick = (tab: Tab) => {
    setActiveTab(tab);
    handleInteraction();
  };

  const handleMarktAnzeigen = () => {
    setShowDetail(true);
    handleInteraction();
  };

  const refreshDayGate = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;
    if (!silent) setDayGateLoading(true);
    try {
      if (daySessionPayload === null) {
        setDayStarted(false);
        return;
      }
      if (daySessionLoading && daySessionPayload === undefined) return;
      const payload = daySessionPayload ?? await fetchCurrentDaySession();
      setDayStarted(
        Boolean(payload.gate?.dayStarted) ||
          isLocalDaySessionSnapshotUsableForStartGate(readLatestLocalDaySessionSnapshot()),
      );
    } catch {
      setDayStarted(isLocalDaySessionSnapshotUsableForStartGate(readLatestLocalDaySessionSnapshot()));
    } finally {
      if (!silent) setDayGateLoading(daySessionLoading && daySessionPayload === undefined);
    }
  }, [daySessionLoading, daySessionPayload]);

  const formatYmd = useCallback((value: string | undefined, fallback: string): string => {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return fallback;
    const [y, m, d] = value.split("-");
    return `${d}.${m}.${y}`;
  }, []);

  const loadProgress = useCallback(async (options?: { force?: boolean }) => {
    if (initialProgressData && !options?.force) {
      setProgressData(initialProgressData);
      setLoadError(null);
      setLoadingData(false);
      return;
    }
    setLoadingData(true);
    try {
      const payload = await fetchGmKuehlerMhdProgress({ force: options?.force });
      setProgressData(payload);
      progressLoadedAtRef.current = Date.now();
      setLoadError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Fortschritt konnte nicht geladen werden.";
      setLoadError(message || "Fortschritt konnte nicht geladen werden.");
      setProgressData(null);
    } finally {
      setLoadingData(false);
    }
  }, [initialProgressData]);

  useEffect(() => {
    if (!initialProgressData) return;
    setProgressData(initialProgressData);
    progressLoadedAtRef.current = Date.now();
    setLoadError(null);
    setLoadingData(false);
  }, [initialProgressData]);

  useEffect(() => {
    void loadProgress();
  }, [loadProgress]);

  useEffect(() => {
    void refreshDayGate();
  }, [refreshDayGate]);

  useEffect(() => {
    const handleDaySessionUpdated = () => {
      if (isLocalDaySessionSnapshotUsableForStartGate(readLatestLocalDaySessionSnapshot())) {
        setDayStarted(true);
        setDayGateLoading(false);
      }
      void refreshDayGate({ silent: true });
    };
    window.addEventListener(DAY_SESSION_UPDATED_EVENT, handleDaySessionUpdated);
    return () => window.removeEventListener(DAY_SESSION_UPDATED_EVENT, handleDaySessionUpdated);
  }, [refreshDayGate]);

  useEffect(() => {
    const onFocus = () => {
      if (Date.now() - progressLoadedAtRef.current < 30_000) return;
      void loadProgress({ force: true });
    };
    const onExternalUpdate = () => {
      void loadProgress({ force: true });
    };
    window.addEventListener("focus", onFocus);
    window.addEventListener(TODAY_SUBMISSIONS_UPDATED_EVENT, onExternalUpdate);
    window.addEventListener(KUEHLER_MHD_PROGRESS_UPDATED_EVENT, onExternalUpdate);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener(TODAY_SUBMISSIONS_UPDATED_EVENT, onExternalUpdate);
      window.removeEventListener(KUEHLER_MHD_PROGRESS_UPDATED_EVENT, onExternalUpdate);
    };
  }, [loadProgress]);

  // Derived values per tab
  const kuehlerPayload = progressData?.kuehler;
  const mhdPayload = progressData?.mhd;
  const kuehlerPercent = kuehlerPayload?.percent ?? (loadingData ? 0 : Math.round((current / Math.max(total, 1)) * 100));
  const mhdPercent = mhdPayload?.percent ?? (loadingData ? 0 : Math.round((mhdCurrent / Math.max(mhdTotal, 1)) * 100));
  const mappedKuehlerMarkets = (kuehlerPayload?.markets ?? []).map((entry) => ({
    marketId: entry.marketId,
    campaignId: entry.campaignId,
    campaignName: entry.campaignName,
    kuehlerUnitId: entry.kuehlerUnitId ?? null,
    kuehlerNumber: entry.kuehlerNumber ?? null,
    chain: entry.chain,
    address: entry.address,
    stammnr: entry.stammnr,
    done: entry.done,
    doneDate: entry.doneAt ? new Date(entry.doneAt).toLocaleDateString("de-AT") : undefined,
  }));
  const mappedMhdMarkets = (mhdPayload?.markets ?? []).map((entry) => ({
    marketId: entry.marketId,
    campaignId: entry.campaignId,
    campaignName: entry.campaignName,
    kuehlerUnitId: entry.kuehlerUnitId ?? null,
    kuehlerNumber: entry.kuehlerNumber ?? null,
    chain: entry.chain,
    address: entry.address,
    stammnr: entry.stammnr,
    done: entry.done,
    doneDate: entry.doneAt ? new Date(entry.doneAt).toLocaleDateString("de-AT") : undefined,
  }));
  const percent = activeTab === "kuehler" ? kuehlerPercent : mhdPercent;
  const cur = activeTab === "kuehler" ? (kuehlerPayload?.current ?? (loadingData ? 0 : current)) : (mhdPayload?.current ?? (loadingData ? 0 : mhdCurrent));
  const tot = activeTab === "kuehler" ? (kuehlerPayload?.total ?? (loadingData ? 0 : total)) : (mhdPayload?.total ?? (loadingData ? 0 : mhdTotal));
  const activeMarkets = activeTab === "kuehler"
    ? (mappedKuehlerMarkets.length > 0 || progressData ? mappedKuehlerMarkets : markets)
    : (mappedMhdMarkets.length > 0 || progressData ? mappedMhdMarkets : mhdMarkets);
  const resolvedStartDate =
    activeTab === "kuehler"
      ? formatYmd(kuehlerPayload?.startDate, startDate)
      : formatYmd(mhdPayload?.startDate, startDate);
  const resolvedEndDate =
    activeTab === "kuehler"
      ? formatYmd(kuehlerPayload?.endDate, endDate)
      : formatYmd(mhdPayload?.endDate, endDate);
  const title = activeTab === "kuehler" ? "Aktuelle Kühlerinventur" : "Aktuelle MHDs";

  const wrapperRef = useRef<HTMLDivElement>(null);
  const [collapsedH, setCollapsedH] = useState<number | undefined>(undefined);
  const [expandedH, setExpandedH] = useState(0);

  useEffect(() => {
    if (!wrapperRef.current) return;
    if (!showDetail && !collapsedH) {
      setCollapsedH(wrapperRef.current.offsetHeight);
    }
    if (showDetail) {
      const top = wrapperRef.current.getBoundingClientRect().top;
      const menuSpace = 80;
      setExpandedH(window.innerHeight - top - menuSpace);
    }
  }, [showDetail, collapsedH]);

  const filtered = useMemo(() => {
    let list = activeMarkets;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (m) =>
          m.chain.toLowerCase().includes(q) ||
          m.address.toLowerCase().includes(q) ||
          String(m.kuehlerNumber ?? "").toLowerCase().includes(q),
      );
    }
    const pending = list.filter((m) => !m.done);
    const done = list.filter((m) => m.done);
    return { pending, done };
  }, [search, activeMarkets]);

  const kuehlerCampaignChoices = useMemo<GmMarketDetailCampaignChoice[]>(() => {
    if (activeTab !== "kuehler" || !selectedMarket) return [];
    return mappedKuehlerMarkets
      .filter((entry) => entry.marketId === selectedMarket.id && Boolean(entry.campaignId))
      .map((entry, index) => ({
        key: getKuehlerChoiceKey(entry, index),
        campaignId: entry.campaignId ?? "",
        campaignName: entry.campaignName || "Kühlerinventur",
        section: "kuehler" as const,
        kuehlerUnitId: entry.kuehlerUnitId ?? null,
        kuehlerNumber: entry.kuehlerNumber ?? entry.stammnr ?? null,
        done: entry.done,
        doneDate: entry.doneDate,
        isStartable: !entry.done,
      }));
  }, [activeTab, mappedKuehlerMarkets, selectedMarket]);

  const selectedKuehlerChoiceKey =
    activeTab === "kuehler" && selectedCampaignIds[0]
      ? kuehlerCampaignChoices.find(
          (choice) =>
            choice.campaignId === selectedCampaignIds[0] &&
            (choice.kuehlerUnitId ?? null) === (selectedKuehlerUnitId ?? null),
        )?.key ?? null
      : null;

  const selectKuehlerChoice = useCallback((choice: GmMarketDetailCampaignChoice) => {
    setSelectedCampaignIds([choice.campaignId]);
    setSelectedKuehlerUnitId(choice.kuehlerUnitId ?? null);
  }, []);

  const closeMarketDetail = useCallback(() => {
    if (isLaunching) return;
    setSelectedMarket(null);
    setMarketDetail(null);
    setMarketDetailError(null);
    setSelectedCampaignIds([]);
    setSelectedKuehlerUnitId(null);
    setLaunchError(null);
  }, [isLaunching]);

  const openMarketDetail = useCallback((market: KuehlerMarket) => {
    if (!market.marketId) return;
    setMarketDetail(null);
    setSelectedMarket(null);
    setSelectedCampaignIds([]);
    setSelectedKuehlerUnitId(activeTab === "kuehler" ? market.kuehlerUnitId ?? null : null);
    setMarketDetailError(null);
    setLaunchError(null);
    setMarketDetailLoading(true);
    void fetchGmMarketDetail(market.marketId)
      .then((payload) => {
        setMarketDetail(payload);
        setSelectedMarket(toMarketListEntry(payload.market, payload.activeCampaigns));
        const preferredCampaign =
          payload.activeCampaigns.find((campaign) => campaign.section === activeTab && campaign.campaignId === market.campaignId && campaign.isStartable) ??
          payload.activeCampaigns.find((campaign) => campaign.section === activeTab && campaign.isStartable) ??
          null;
        setSelectedCampaignIds(preferredCampaign ? [preferredCampaign.campaignId] : []);
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : "Marktdetails konnten nicht geladen werden.";
        setMarketDetailError(message);
        setSelectedMarket({
          id: market.marketId ?? "unknown",
          name: market.address || "Markt",
          chain: market.chain,
          address: market.address,
          visited: 0,
          frequency: 1,
          visitedThisMonth: market.done,
          record: {
            id: market.marketId ?? "unknown",
            name: market.address || "Markt",
            dbName: market.chain,
            address: market.address,
            postalCode: "",
            city: "",
            region: "",
            flexNumber: "",
            standardMarketNumber: "",
            cokeMasterNumber: "",
            kuehlerStammnr: "",
            emEh: "",
            employee: "",
            currentGmName: "",
            plannedToId: null,
            plannedByActiveStandardGmName: null,
            visitFrequencyPerYear: 0,
            infoFlag: false,
            infoNote: "",
            ipp: null,
            universeMarket: false,
            marketType: activeTab === "kuehler" ? "kuehler" : "universum",
            isActive: true,
            importSourceFileName: "",
            importedAt: "",
          },
          activeNowCampaigns: [],
        });
      })
      .finally(() => setMarketDetailLoading(false));
  }, [activeTab]);

  const toggleCampaign = useCallback((campaignId: string) => {
    setSelectedCampaignIds((current) =>
      current.includes(campaignId) ? current.filter((id) => id !== campaignId) : [...current, campaignId],
    );
  }, []);

  const blockedActiveCampaignNames = useMemo(
    () => Array.from(new Set((blockedActiveVisit?.sections ?? []).map((section) => section.campaignName).filter(Boolean))),
    [blockedActiveVisit],
  );

  const openBlockedActiveVisit = useCallback(async () => {
    if (!blockedActiveVisit || blockedActiveOpening) return;
    setBlockedActiveOpening(true);
    try {
      const payload = await fetchGmVisitSession(blockedActiveVisit.session.id);
      setGmVisitPreloadCache(payload);
      const campaignIds = Array.from(new Set(payload.sections.map((section) => section.campaignId).filter(Boolean)));
      const address = [
        payload.market.address,
        [payload.market.postalCode, payload.market.city].filter(Boolean).join(" "),
      ].filter(Boolean).join(", ");
      router.push(
        `/gm/marktbesuch?chain=${encodeURIComponent(payload.market.name)}&address=${encodeURIComponent(address)}&marketId=${encodeURIComponent(payload.market.id)}&campaignIds=${encodeURIComponent(campaignIds.join(","))}&sessionId=${encodeURIComponent(payload.session.id)}`,
      );
    } catch {
      setBlockedActiveOpening(false);
      setLaunchError("Aktiver Fragebogen konnte nicht geoeffnet werden. Bitte erneut versuchen.");
    }
  }, [blockedActiveOpening, blockedActiveVisit, router]);

  const launchVisit = useCallback(
    async (market: GmDashboardMarket, campaignIds: string[], sessionId?: string, kuehlerUnitId?: string | null) => {
      if (!dayStarted) {
        setLaunchError("Bitte zuerst den Arbeitstag starten.");
        return;
      }
      if (pauseActive) {
        setLaunchError("Bitte zuerst die aktive Pause beenden.");
        return;
      }
      if (campaignIds.length === 0) {
        setLaunchError("Bitte mindestens eine Kampagne auswählen.");
        return;
      }

      setIsLaunching(true);
      setLaunchError(null);
      setBlockedActiveVisit(null);
      try {
        let sessionParam = "";
        if (sessionId) {
          const payload = await fetchGmVisitSession(sessionId);
          setGmVisitPreloadCache(payload);
          sessionParam = `&sessionId=${encodeURIComponent(sessionId)}`;
        } else {
          const activeVisit = await fetchActiveGmVisitSession({
            marketId: market.id,
            campaignIds,
            kuehlerUnitId,
          });
          if (activeVisit.session?.id) {
            const payload = await fetchGmVisitSession(activeVisit.session.id);
            setGmVisitPreloadCache(payload);
            sessionParam = `&sessionId=${encodeURIComponent(activeVisit.session.id)}`;
          } else {
            const latestActiveVisit = await fetchLatestActiveGmVisitSession();
            if (latestActiveVisit.session?.id) {
              setIsLaunching(false);
              setBlockedActiveVisit(latestActiveVisit as GmVisitSessionPayload);
              return;
            }
            const payload = await fetchGmVisitStartPayload(market.id, campaignIds, { kuehlerUnitId });
            setGmVisitStartPreloadCache({
              marketId: market.id,
              campaignIds,
              kuehlerUnitId,
              payload,
            });
          }
        }

        const kuehlerUnitParam = kuehlerUnitId ? `&kuehlerUnitId=${encodeURIComponent(kuehlerUnitId)}` : "";
        router.push(
          `/gm/marktbesuch?chain=${encodeURIComponent(market.chain)}&address=${encodeURIComponent(market.address)}&marketId=${encodeURIComponent(market.id)}&campaignIds=${encodeURIComponent(campaignIds.join(","))}${sessionParam}${kuehlerUnitParam}`,
        );
      } catch {
        setIsLaunching(false);
        setLaunchError("Marktbesuch konnte nicht vorbereitet werden. Bitte erneut versuchen.");
      }
    },
    [dayStarted, pauseActive, router],
  );

  const handleStartSelected = useCallback(() => {
    if (!selectedMarket) return;
    void launchVisit(selectedMarket, selectedCampaignIds, undefined, activeTab === "kuehler" ? selectedKuehlerUnitId : null);
  }, [activeTab, launchVisit, selectedCampaignIds, selectedKuehlerUnitId, selectedMarket]);

  const handleContinueDraft = useCallback(
    (sessionId: string, campaignIds: string[]) => {
      if (!selectedMarket) return;
      void launchVisit(selectedMarket, campaignIds, sessionId);
    },
    [launchVisit, selectedMarket],
  );

  return (
    <div
      style={{
        position: "relative",
        height: collapsedH || "auto",
        zIndex: showDetail ? 30 : "auto",
      }}
      onPointerDown={handleInteraction}
      onScroll={handleInteraction}
    >
      <div
        ref={wrapperRef}
        style={{
          backgroundColor: "#ffffff",
          borderRadius: 14,
          boxShadow: showDetail ? "0 8px 30px rgba(0,0,0,0.08)" : "0 2px 8px rgba(0,0,0,0.04)",
          padding: "20px",
          position: showDetail ? "absolute" : "relative",
          top: 0,
          left: 0,
          right: 0,
          zIndex: showDetail ? 20 : "auto",
          height: showDetail && expandedH ? expandedH : undefined,
          transition: "height 0.4s cubic-bezier(0.4,0,0.2,1), box-shadow 0.4s ease",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Summary View */}
        <div
          style={{
            opacity: showDetail ? 0 : 1,
            pointerEvents: showDetail ? "none" : "auto",
            transition: "opacity 0.2s ease",
            position: showDetail ? "absolute" : "relative",
          }}
        >
          <div
            style={{
              backgroundColor: "rgba(0,0,0,0.03)",
              borderRadius: 7,
              padding: "10px 12px",
            }}
          >
            <div className="flex items-center justify-between">
              <span
                className="text-[12px] font-semibold text-gray-700"
                style={{ transition: "opacity 0.2s ease" }}
              >
                {title}
              </span>
              <span className="text-[10px] tabular-nums text-gray-400">
                {resolvedStartDate} – {resolvedEndDate}
              </span>
            </div>

            <div className="mt-3 flex items-center gap-3">
              <div
                className="flex-1 overflow-hidden"
                style={{ height: 6, borderRadius: 3, backgroundColor: "rgba(0,0,0,0.04)" }}
              >
                <div
                  style={{
                    width: `${percent}%`,
                    height: "100%",
                    borderRadius: 3,
                    backgroundColor: "#DC2626",
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.25)",
                    transition: "width 0.4s ease",
                  }}
                />
              </div>
              <span className="text-[11px] font-semibold tabular-nums text-gray-600 shrink-0">
                {cur}/{tot}
              </span>
            </div>
          </div>

          {/* Bottom row: tabs left, märkte anzeigen right */}
          <div className="mt-3 flex items-center justify-between">
            {/* Tab switcher */}
            <div style={{ display: "flex", gap: 2 }}>
              {(["kuehler", "mhd"] as Tab[]).map((tab) => {
                const active = activeTab === tab;
                const label = tab === "kuehler" ? "Kühleri…" : "MHD";
                return (
                    <button
                      key={tab}
                      onClick={() => handleTabClick(tab)}
                      style={{
                        padding: "2px 6px",
                        borderRadius: 4,
                        border: "none",
                        cursor: "pointer",
                        fontSize: 10,
                        fontWeight: active ? 600 : 500,
                        letterSpacing: "0.01em",
                        transition: "all 0.18s ease",
                        background: "transparent",
                        color: active ? "rgba(0,0,0,0.55)" : "rgba(0,0,0,0.22)",
                      }}
                    >
                    {label}
                  </button>
                );
              })}
            </div>

            <button
              onClick={handleMarktAnzeigen}
              style={{
                padding: 0,
                fontSize: 10,
                fontWeight: 600,
                color: "#DC2626",
                backgroundColor: "transparent",
                border: "none",
                cursor: "pointer",
                transition: "opacity 0.15s ease",
                letterSpacing: "0.01em",
              }}
            >
              Märkte anzeigen
            </button>
          </div>
          {loadError && (
            <div style={{ marginTop: 6, fontSize: 10, color: "rgba(220,38,38,0.72)", fontWeight: 500 }}>
              Fortschritt konnte nicht geladen werden.
            </div>
          )}
        </div>

        {/* Detail View */}
        <div
          style={{
            opacity: showDetail ? 1 : 0,
            pointerEvents: showDetail ? "auto" : "none",
            transition: "opacity 0.25s ease 0.1s",
            display: showDetail ? "flex" : "none",
            flexDirection: "column",
            flex: 1,
            minHeight: 0,
          }}
        >
          {/* Header bar */}
          <div
            className="shrink-0"
            style={{ backgroundColor: "rgba(0,0,0,0.03)", borderRadius: 7, padding: "10px 12px" }}
          >
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-semibold text-gray-700">{title}</span>
              <button
                onClick={() => { setShowDetail(false); setSearch(""); }}
                className="flex items-center justify-center"
                style={{
                  width: 22, height: 22, borderRadius: 7,
                  backgroundColor: "rgba(0,0,0,0.04)", border: "none",
                  cursor: "pointer", transition: "background-color 0.15s ease",
                }}
              >
                <X size={11} strokeWidth={2} color="rgba(0,0,0,0.35)" />
              </button>
            </div>

            <div className="mt-3 flex items-center gap-3">
              <div
                className="flex-1 overflow-hidden"
                style={{ height: 6, borderRadius: 3, backgroundColor: "rgba(0,0,0,0.04)" }}
              >
                <div
                  style={{
                    width: `${percent}%`,
                    height: "100%",
                    borderRadius: 3,
                    backgroundColor: "#DC2626",
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.25)",
                    transition: "width 0.4s ease",
                  }}
                />
              </div>
              <span className="text-[11px] font-semibold tabular-nums text-gray-600 shrink-0">
                {cur}/{tot}
              </span>
            </div>
          </div>

          {/* Search */}
          <div className="relative mt-3 shrink-0">
            <Search
              size={11}
              strokeWidth={1.8}
              className="absolute"
              style={{ left: 8, top: "50%", transform: "translateY(-50%)", color: "rgba(0,0,0,0.25)" }}
            />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); handleInteraction(); }}
              placeholder="Markt suchen..."
              className="w-full text-[10px] text-gray-600 placeholder-gray-300 outline-none"
              style={{
                padding: "5px 10px 5px 24px",
                backgroundColor: "transparent",
                borderBottom: "1px solid rgba(0,0,0,0.06)",
                borderTop: "none", borderLeft: "none", borderRight: "none",
                borderRadius: 0,
              }}
            />
          </div>

          {/* Market List */}
          <div
            className="mt-2"
            style={{ flex: 1, minHeight: 0, overflowY: "auto", scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {filtered.pending.length > 0 && (
              <div>
                <span
                  className="text-[9px] font-semibold uppercase tracking-[0.06em] block"
                  style={{ color: "#DC2626", padding: "8px 0 4px" }}
                >
                  Offen ({filtered.pending.length})
                </span>
                {filtered.pending.map((m, i) => {
                  const cc = chainColor(m.chain);
                  return (
                    <div
                      key={`p-${i}`}
                      className="flex items-center justify-between"
                      onClick={() => openMarketDetail(m)}
                      style={{
                        padding: "7px 4px",
                        borderBottom: i < filtered.pending.length - 1 ? "1px solid rgba(0,0,0,0.04)" : "none",
                        transition: "background-color 0.12s ease",
                        borderRadius: 5, cursor: m.marketId ? "pointer" : "default",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.015)")}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Circle size={10} strokeWidth={2} color="rgba(220,38,38,0.4)" className="shrink-0" />
                        <span
                          className="shrink-0 text-[8px] font-semibold uppercase"
                          style={{ padding: "1px 6px", borderRadius: 4, backgroundColor: cc.bg, color: cc.text, letterSpacing: "0.02em" }}
                        >
                          {m.chain}
                        </span>
                        <span className="text-[9px] font-medium text-gray-500 truncate">{m.address}</span>
                      </div>
                      <div className="flex items-center shrink-0">
                        <KuehlerNumberValue value={activeTab === "kuehler" ? m.kuehlerNumber : null} />
                        <StammnrValue value={m.stammnr} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {filtered.pending.length > 0 && filtered.done.length > 0 && (
              <div className="my-2" style={{ height: 1, background: "linear-gradient(90deg, transparent, rgba(0,0,0,0.06) 50%, transparent)" }} />
            )}

            {filtered.done.length > 0 && (
              <div>
                <span
                  className="text-[9px] font-semibold uppercase tracking-[0.06em] block"
                  style={{ color: "#059669", padding: "8px 0 4px" }}
                >
                  Erledigt ({filtered.done.length})
                </span>
                {filtered.done.map((m, i) => {
                  const cc = chainColor(m.chain);
                  return (
                    <div
                      key={`d-${i}`}
                      className="flex items-center justify-between"
                      onClick={() => openMarketDetail(m)}
                      style={{
                        padding: "7px 4px",
                        borderBottom: i < filtered.done.length - 1 ? "1px solid rgba(0,0,0,0.04)" : "none",
                        transition: "background-color 0.12s ease",
                        borderRadius: 5, cursor: m.marketId ? "pointer" : "default",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.015)")}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <CheckCircle2 size={10} strokeWidth={2} color="#059669" className="shrink-0" />
                        <span
                          className="shrink-0 text-[8px] font-semibold uppercase"
                          style={{ padding: "1px 6px", borderRadius: 4, backgroundColor: cc.bg, color: cc.text, letterSpacing: "0.02em" }}
                        >
                          {m.chain}
                        </span>
                        <span className="text-[9px] font-medium text-gray-500 truncate">{m.address}</span>
                      </div>
                      <div className="flex items-center shrink-0">
                        <KuehlerNumberValue value={activeTab === "kuehler" ? m.kuehlerNumber : null} />
                        <StammnrValue value={m.stammnr} />
                        <span className="text-[8px] tabular-nums shrink-0 ml-2" style={{ color: "rgba(5,150,105,0.72)", fontWeight: 650 }}>{m.doneDate}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {filtered.pending.length === 0 && filtered.done.length === 0 && (
              loadingData ? (
                <div style={{ padding: "6px 0 10px" }}>
                  <GmSkeletonMarketRows count={5} />
                </div>
              ) : (
                <div className="text-center py-6">
                  <span className="text-[10px] text-gray-400">
                    {search.trim().length > 0
                      ? "Keine Märkte gefunden"
                      : "Keine zugewiesenen Märkte"}
                  </span>
                </div>
              )
            )}
          </div>
        </div>
        {!dayGateLoading && dayStarted && pauseActive && (
          <DashboardGateOverlay
            loading={false}
            locked
            lockTitle="Pause"
            lockText="Beende zuerst deine Pause. Danach kannst du Kühler- und MHD-Besuche wieder starten."
            inset={10}
          />
        )}
      </div>
      {selectedMarket && (
        <GmMarketDetailModal
          market={selectedMarket}
          detail={marketDetail}
          isLoading={marketDetailLoading}
          error={marketDetailError}
          sectionFilter={[activeTab]}
          selectedCampaignIds={selectedCampaignIds}
          campaignChoices={activeTab === "kuehler" ? kuehlerCampaignChoices : undefined}
          selectedCampaignChoiceKey={activeTab === "kuehler" ? selectedKuehlerChoiceKey : undefined}
          isLaunching={isLaunching}
          dayStarted={dayStarted}
          dayGateLoading={dayGateLoading}
          activeVisitLocked={activeVisitLocked}
          pauseActive={pauseActive}
          launchError={launchError}
          onToggleCampaign={toggleCampaign}
          onSelectCampaignChoice={selectKuehlerChoice}
          onStart={handleStartSelected}
          onContinueDraft={handleContinueDraft}
          onClose={closeMarketDetail}
        />
      )}
      <ActiveFragebogenBlockModal
        open={Boolean(blockedActiveVisit)}
        opening={blockedActiveOpening}
        marketName={blockedActiveVisit?.market.name}
        campaignNames={blockedActiveCampaignNames}
        onClose={() => {
          if (blockedActiveOpening) return;
          setBlockedActiveVisit(null);
        }}
        onOpenActive={() => {
          void openBlockedActiveVisit();
        }}
      />
    </div>
  );
}
