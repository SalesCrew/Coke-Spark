"use client";

import React, {
  memo,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  Check,
  ChevronDown,
  Info,
  MapPin,
  Search,
  Store,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import { fetchSmUsers } from "@/lib/api/backend";
import type { SMRecord } from "@/types/shelfmerchandiser";

const COKE_RED = "#DC2626";
const ROW_HEIGHT = 54;
const OVERSCAN = 8;
const LIST_GRID = "minmax(225px,1.45fr) minmax(100px,.64fr) 34px minmax(170px,1.05fr) minmax(70px,.46fr) 56px minmax(120px,.76fr) minmax(185px,1.08fr) 76px";
const LIST_GAP = "0 10px";

type AssignmentMap = Record<string, string | null>;

type SmMarketPreview = {
  id: string;
  name: string;
  dbName: string;
  internalId: string;
  address: string;
  postalCode: string;
  city: string;
  region: string;
  infoFlag: boolean;
  infoNote: string;
  isActive: boolean;
};

type MarketFilters = {
  region: string | null;
  city: string | null;
  postalCode: string | null;
  chain: string | null;
  smId: string | null;
  status: "Aktiv" | "Inaktiv" | null;
};

type SelectOption = {
  value: string;
  label: string;
  subLabel?: string;
};

const EMPTY_FILTERS: MarketFilters = {
  region: null,
  city: null,
  postalCode: null,
  chain: null,
  smId: null,
  status: null,
};

const TEMP_SM_USERS: SMRecord[] = [
  { id: "preview-sm-adriana", firstName: "Adriana", lastName: "Maier", email: "adriana.maier@merch.at", phone: "+43 660 120 10 01", address: "Wiener Straße 12", city: "Wien", postalCode: "1010", region: "Ost", createdAt: "2026-08-01T08:00:00.000Z" },
  { id: "preview-sm-sophie", firstName: "Sophie", lastName: "Gruber", email: "sophie.gruber@merch.at", phone: "+43 660 120 10 02", address: "Bahnhofstraße 8", city: "Graz", postalCode: "8010", region: "Süd", createdAt: "2026-08-01T08:00:00.000Z" },
  { id: "preview-sm-daniel", firstName: "Daniel", lastName: "Huber", email: "daniel.huber@merch.at", phone: "+43 660 120 10 03", address: "Landstraße 20", city: "Linz", postalCode: "4020", region: "Nord", createdAt: "2026-08-01T08:00:00.000Z" },
  { id: "preview-sm-miriam", firstName: "Miriam", lastName: "Leitner", email: "miriam.leitner@merch.at", phone: "+43 660 120 10 04", address: "Innrain 4", city: "Innsbruck", postalCode: "6020", region: "West", createdAt: "2026-08-01T08:00:00.000Z" },
];

const TEMP_SM_MARKETS: SmMarketPreview[] = [
  { id: "sm-market-001", name: "Billa Plus", dbName: "Billa Plus", internalId: "120076320", address: "Habsburg Lothringen Straße 002", postalCode: "3950", city: "Gmünd", region: "Ost", infoFlag: true, infoNote: "Warenübernahme über den Seiteneingang.", isActive: true },
  { id: "sm-market-002", name: "Billa", dbName: "Billa", internalId: "120008341", address: "Technologiepark 1", postalCode: "8380", city: "Jennersdorf", region: "Süd", infoFlag: false, infoNote: "", isActive: true },
  { id: "sm-market-003", name: "Eurospar", dbName: "Eurospar", internalId: "120010557", address: "Hauptstraße 74", postalCode: "5600", city: "St. Johann im Pongau", region: "West", infoFlag: false, infoNote: "", isActive: true },
  { id: "sm-market-004", name: "Interspar", dbName: "Interspar", internalId: "120011204", address: "Industriezeile 76", postalCode: "4020", city: "Linz", region: "Nord", infoFlag: true, infoNote: "Anmeldung zuerst beim Infopoint.", isActive: true },
  { id: "sm-market-005", name: "ADEG", dbName: "ADEG", internalId: "120015908", address: "Oberwarter Straße 339", postalCode: "7355", city: "St. Michael im Burgenland", region: "Ost", infoFlag: false, infoNote: "", isActive: true },
  { id: "sm-market-006", name: "Sparmarkt", dbName: "Sparmarkt", internalId: "120018128", address: "Gemeindeplatz 002", postalCode: "5591", city: "Ramingstein", region: "West", infoFlag: false, infoNote: "", isActive: true },
  { id: "sm-market-007", name: "Billa", dbName: "Billa", internalId: "120021234", address: "Pass Thurn Straße 017", postalCode: "6380", city: "St. Johann in Tirol", region: "West", infoFlag: true, infoNote: "Kurze Zufahrt über die Rückseite.", isActive: true },
  { id: "sm-market-008", name: "Billa Plus", dbName: "Billa Plus", internalId: "120024810", address: "Salzburgerstraße 223 TOP 1/9", postalCode: "4600", city: "Wels", region: "Nord", infoFlag: false, infoNote: "", isActive: true },
  { id: "sm-market-009", name: "Penny", dbName: "Penny", internalId: "120027445", address: "Grazer Straße 41", postalCode: "2700", city: "Wiener Neustadt", region: "Ost", infoFlag: false, infoNote: "", isActive: true },
  { id: "sm-market-010", name: "Spar", dbName: "Spar", internalId: "120030112", address: "Bahnhofstraße 18", postalCode: "6850", city: "Dornbirn", region: "West", infoFlag: false, infoNote: "", isActive: true },
  { id: "sm-market-011", name: "Billa", dbName: "Billa", internalId: "120033520", address: "Kärntner Straße 25", postalCode: "8510", city: "Stainz", region: "Süd", infoFlag: true, infoNote: "Fixes Zeitfenster vor Marktöffnung beachten.", isActive: true },
  { id: "sm-market-012", name: "Eurospar", dbName: "Eurospar", internalId: "120036819", address: "Schmiedingerstraße 35", postalCode: "5020", city: "Salzburg", region: "West", infoFlag: false, infoNote: "", isActive: true },
  { id: "sm-market-013", name: "Billa Plus", dbName: "Billa Plus", internalId: "120039551", address: "Mariahilfer Straße 38–48", postalCode: "1070", city: "Wien", region: "Ost", infoFlag: false, infoNote: "", isActive: true },
  { id: "sm-market-014", name: "ADEG", dbName: "ADEG", internalId: "120042667", address: "Dorfstraße 35", postalCode: "2460", city: "Bruck an der Leitha", region: "Ost", infoFlag: false, infoNote: "", isActive: true },
  { id: "sm-market-015", name: "Billa", dbName: "Billa", internalId: "120045301", address: "Seiersberg 1–9", postalCode: "8055", city: "Seiersberg-Pirka", region: "Süd", infoFlag: false, infoNote: "", isActive: true },
  { id: "sm-market-016", name: "Interspar", dbName: "Interspar", internalId: "120048974", address: "Neu-Rum Serlesstraße 11", postalCode: "6063", city: "Rum", region: "West", infoFlag: true, infoNote: "Zutritt zum Lager nur mit Marktleitung.", isActive: true },
  { id: "sm-market-017", name: "Billa", dbName: "Billa", internalId: "120051006", address: "Landstraße 82", postalCode: "4020", city: "Linz", region: "Nord", infoFlag: false, infoNote: "", isActive: false },
  { id: "sm-market-018", name: "Sparmarkt", dbName: "Sparmarkt", internalId: "120054620", address: "Kirchenstraße 3", postalCode: "4800", city: "Attnang-Puchheim", region: "Nord", infoFlag: false, infoNote: "", isActive: true },
];

function normalize(value: string): string {
  return value
    .toLocaleLowerCase("de-AT")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function formatSmName(sm: SMRecord): string {
  const fullName = `${sm.firstName ?? ""} ${sm.lastName ?? ""}`.trim();
  return fullName || sm.email || "Unbenannter SM";
}

function marketInternalId(market: SmMarketPreview): string {
  return market.internalId;
}

function marketChain(market: SmMarketPreview): string {
  return market.dbName.trim() || market.name.split(" ")[0]?.trim() || "Markt";
}

function chainColors(name: string): { background: string; color: string } {
  const normalized = name.toLocaleUpperCase("de-AT");
  if (normalized.includes("BILLA")) return { background: "rgba(234,179,8,0.12)", color: "#a16207" };
  if (normalized.includes("SPAR")) return { background: "rgba(220,38,38,0.08)", color: COKE_RED };
  if (normalized.includes("ADEG")) return { background: "rgba(34,197,94,0.08)", color: "#15803d" };
  if (normalized.includes("HOFER")) return { background: "rgba(16,185,129,0.08)", color: "#065f46" };
  if (normalized.includes("PENNY")) return { background: "rgba(194,65,12,0.08)", color: "#c2410c" };
  return { background: "rgba(0,0,0,0.05)", color: "#6b7280" };
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "de-AT", { sensitivity: "base", numeric: true }),
  );
}

function buildSearchText(market: SmMarketPreview, assignedSm: SMRecord | undefined): string {
  return normalize(
    [
      market.name,
      market.dbName,
      marketInternalId(market),
      market.address,
      market.postalCode,
      market.city,
      market.region,
      market.infoNote,
      assignedSm ? formatSmName(assignedSm) : "",
      assignedSm?.email ?? "",
    ].join(" "),
  );
}

function initials(sm: SMRecord): string {
  const value = `${sm.firstName?.charAt(0) ?? ""}${sm.lastName?.charAt(0) ?? ""}`.toLocaleUpperCase("de-AT");
  return value || "SM";
}

function useAnchoredPosition(
  anchorRef: React.RefObject<HTMLElement | null>,
  open: boolean,
  width: number,
): { top: number; left: number; width: number } | null {
  const [position, setPosition] = useState<{ top: number; left: number; width: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    const update = () => {
      const anchor = anchorRef.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      const menuWidth = Math.max(width, rect.width);
      const preferredLeft = rect.left;
      const left = Math.min(preferredLeft, window.innerWidth - menuWidth - 12);
      setPosition({ top: rect.bottom + 5, left: Math.max(12, left), width: menuWidth });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [anchorRef, open, width]);

  return position;
}

function PortalSelectMenu({
  anchorRef,
  open,
  options,
  value,
  nullLabel,
  searchable,
  onChange,
  onClose,
}: {
  anchorRef: React.RefObject<HTMLElement | null>;
  open: boolean;
  options: SelectOption[];
  value: string | null;
  nullLabel: string;
  searchable?: boolean;
  onChange: (value: string | null) => void;
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState("");
  const position = useAnchoredPosition(anchorRef, open, searchable ? 250 : 180);

  useEffect(() => {
    if (!open) {
      setSearch("");
      return;
    }
    const closeFromOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || anchorRef.current?.contains(target)) return;
      onClose();
    };
    document.addEventListener("mousedown", closeFromOutside);
    return () => document.removeEventListener("mousedown", closeFromOutside);
  }, [anchorRef, onClose, open]);

  const visibleOptions = useMemo(() => {
    const query = normalize(search);
    if (!query) return options;
    return options.filter((option) => normalize(`${option.label} ${option.subLabel ?? ""}`).includes(query));
  }, [options, search]);

  if (!open || !position || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={menuRef}
      className="sm-market-scroll"
      role="listbox"
      style={{
        position: "fixed",
        top: position.top,
        left: position.left,
        width: position.width,
        zIndex: 12000,
        maxHeight: 360,
        overflowY: "auto",
        padding: 4,
        border: "1px solid rgba(0,0,0,0.08)",
        borderRadius: 9,
        background: "#fff",
        boxShadow: "0 10px 30px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.05)",
      }}
      onClick={(event) => event.stopPropagation()}
    >
      {searchable ? (
        <div style={{ padding: "4px 4px 7px" }}>
          <div style={{ height: 29, display: "flex", alignItems: "center", gap: 7, padding: "0 9px", borderRadius: 7, border: "1px solid rgba(0,0,0,0.08)", background: "rgba(0,0,0,0.018)" }}>
            <Search size={11} strokeWidth={2} color="rgba(0,0,0,0.3)" />
            <input
              autoFocus
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="SM suchen…"
              style={{ minWidth: 0, flex: 1, border: "none", outline: "none", background: "transparent", fontFamily: "inherit", fontSize: 10.5, color: "#1a1a1a" }}
            />
          </div>
        </div>
      ) : null}

      <button
        type="button"
        role="option"
        aria-selected={value === null}
        onClick={() => {
          onChange(null);
          onClose();
        }}
        className="sm-select-option"
        style={{ background: value === null ? "rgba(220,38,38,0.055)" : "transparent", color: value === null ? COKE_RED : "#374151" }}
      >
        <span>{nullLabel}</span>
        {value === null ? <Check size={11} strokeWidth={2.5} /> : null}
      </button>

      {visibleOptions.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="option"
            aria-selected={selected}
            onClick={() => {
              onChange(option.value);
              onClose();
            }}
            className="sm-select-option"
            style={{ background: selected ? "rgba(220,38,38,0.055)" : "transparent", color: selected ? COKE_RED : "#374151" }}
          >
            <span style={{ minWidth: 0, textAlign: "left" }}>
              <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: selected ? 700 : 550 }}>{option.label}</span>
              {option.subLabel ? <span style={{ display: "block", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 8.5, color: "rgba(0,0,0,0.34)" }}>{option.subLabel}</span> : null}
            </span>
            {selected ? <Check size={11} strokeWidth={2.5} style={{ flexShrink: 0 }} /> : null}
          </button>
        );
      })}

      {visibleOptions.length === 0 ? (
        <div style={{ padding: "18px 10px", textAlign: "center", fontSize: 10, color: "rgba(0,0,0,0.34)" }}>Kein SM gefunden.</div>
      ) : null}
    </div>,
    document.body,
  );
}

function SmAssignmentSelect({
  value,
  users,
  compact,
  onChange,
}: {
  value: string | null;
  users: SMRecord[];
  compact?: boolean;
  onChange: (value: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const selected = users.find((user) => user.id === value);
  const options = useMemo<SelectOption[]>(
    () => users.map((user) => ({ value: user.id, label: formatSmName(user), subLabel: user.email })),
    [users],
  );

  return (
    <div onClick={(event) => event.stopPropagation()} style={{ minWidth: 0 }}>
      <button
        ref={anchorRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="sm-assignment-button"
        style={{
          minHeight: compact ? 29 : 34,
          width: "100%",
          padding: compact ? "4px 7px" : "5px 8px",
          border: "1px solid rgba(0,0,0,0.085)",
          borderRadius: compact ? 7 : 8,
          background: selected ? "#fff" : "rgba(0,0,0,0.022)",
          display: "flex",
          alignItems: "center",
          gap: 7,
          cursor: "pointer",
          fontFamily: "inherit",
          textAlign: "left",
        }}
      >
        {selected ? (
          <span style={{ width: compact ? 20 : 22, height: compact ? 20 : 22, borderRadius: 6, background: "rgba(220,38,38,0.07)", color: COKE_RED, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 8, fontWeight: 800 }}>
            {initials(selected)}
          </span>
        ) : (
          <span style={{ width: compact ? 20 : 22, height: compact ? 20 : 22, borderRadius: 6, background: "rgba(0,0,0,0.035)", color: "rgba(0,0,0,0.28)", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <UserRound size={10} strokeWidth={1.8} />
          </span>
        )}
        <span style={{ minWidth: 0, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: compact ? 10 : 10.5, fontWeight: selected ? 650 : 500, color: selected ? "#262626" : "rgba(0,0,0,0.38)" }}>
          {selected ? formatSmName(selected) : "Nicht zugewiesen"}
        </span>
        <ChevronDown size={10} strokeWidth={2} color="rgba(0,0,0,0.32)" style={{ flexShrink: 0 }} />
      </button>
      <PortalSelectMenu
        anchorRef={anchorRef}
        open={open}
        options={options}
        value={value}
        nullLabel="Nicht zugewiesen"
        searchable
        onChange={onChange}
        onClose={() => setOpen(false)}
      />
    </div>
  );
}

function FilterButton({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string | null;
  options: SelectOption[];
  onChange: (value: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const selectedLabel = options.find((option) => option.value === value)?.label;

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="sm-filter-button"
        style={{ color: value ? COKE_RED : "rgba(0,0,0,0.58)", background: value ? "rgba(220,38,38,0.045)" : "linear-gradient(to bottom,#fff,#f7f7f7)" }}
      >
        <span style={{ maxWidth: 112, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selectedLabel ?? label}</span>
        <ChevronDown size={9} strokeWidth={2} />
      </button>
      <PortalSelectMenu
        anchorRef={anchorRef}
        open={open}
        options={options}
        value={value}
        nullLabel="Alle"
        searchable={options.length > 14}
        onChange={onChange}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

const MarketRow = memo(function MarketRow({
  market,
  active,
  assignedSmId,
  users,
  onSelect,
  onAssign,
}: {
  market: SmMarketPreview;
  active: boolean;
  assignedSmId: string | null;
  users: SMRecord[];
  onSelect: (marketId: string) => void;
  onAssign: (marketId: string, smId: string | null) => void;
}) {
  const chain = marketChain(market);
  const colors = chainColors(chain);
  const baseBackground = market.isActive ? "transparent" : "rgba(220,38,38,0.018)";

  return (
    <div
      onClick={() => onSelect(market.id)}
      className="sm-market-row"
      style={{
        display: "grid",
        gridTemplateColumns: LIST_GRID,
        gap: LIST_GAP,
        height: ROW_HEIGHT,
        padding: "10px 18px",
        boxSizing: "border-box",
        alignItems: "center",
        borderBottom: "1px solid rgba(0,0,0,0.04)",
        borderLeft: active ? `3px solid ${COKE_RED}` : "3px solid transparent",
        background: active ? "rgba(220,38,38,0.04)" : baseBackground,
        cursor: "pointer",
        outline: "none",
      }}
    >
      <div style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ flexShrink: 0, padding: "2px 7px", borderRadius: 5, background: colors.background, color: colors.color, fontSize: 9, fontWeight: 750, letterSpacing: "0.02em", textTransform: "uppercase" }}>
          {chain}
        </span>
        <div style={{ minWidth: 0 }}>
          <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12, fontWeight: 650, color: active ? COKE_RED : "#1a1a1a", letterSpacing: "-0.01em" }}>{market.name}</div>
          <div style={{ marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 9, color: "rgba(0,0,0,0.35)" }}>{market.dbName}</div>
        </div>
      </div>
      <div className="sm-table-value sm-tabular">{marketInternalId(market)}</div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        {market.infoFlag || market.infoNote.trim() ? <span title={market.infoNote || "Info vorhanden"} style={{ width: 6, height: 6, borderRadius: 999, background: COKE_RED }} /> : null}
      </div>
      <div className="sm-table-value">{market.address}</div>
      <div className="sm-table-value">{market.region}</div>
      <div className="sm-table-value sm-tabular">{market.postalCode}</div>
      <div className="sm-table-value">{market.city}</div>
      <SmAssignmentSelect value={assignedSmId} users={users} compact onChange={(smId) => onAssign(market.id, smId)} />
      <span style={{ justifySelf: "start", padding: "3px 7px", borderRadius: 999, background: market.isActive ? "rgba(22,163,74,0.07)" : "rgba(0,0,0,0.04)", color: market.isActive ? "#15803d" : "rgba(0,0,0,0.4)", fontSize: 9, fontWeight: 700 }}>
        {market.isActive ? "Aktiv" : "Inaktiv"}
      </span>
    </div>
  );
});

function VirtualMarketList({
  markets,
  users,
  assignments,
  selectedId,
  onSelect,
  onAssign,
}: {
  markets: SmMarketPreview[];
  users: SMRecord[];
  assignments: AssignmentMap;
  selectedId: string | null;
  onSelect: (marketId: string) => void;
  onAssign: (marketId: string, smId: string | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(600);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    setContainerHeight(element.clientHeight);
    const handleScroll = () => setScrollTop(element.scrollTop);
    const observer = new ResizeObserver(() => setContainerHeight(element.clientHeight));
    element.addEventListener("scroll", handleScroll, { passive: true });
    observer.observe(element);
    return () => {
      element.removeEventListener("scroll", handleScroll);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    containerRef.current?.scrollTo({ top: 0 });
    setScrollTop(0);
  }, [markets]);

  if (markets.length === 0) {
    return (
      <div style={{ minHeight: 280, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 10, color: "rgba(0,0,0,0.34)" }}>
        <MapPin size={22} strokeWidth={1.4} />
        <span style={{ fontSize: 11, fontWeight: 550 }}>Keine Märkte gefunden.</span>
      </div>
    );
  }

  const totalHeight = markets.length * ROW_HEIGHT;
  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const endIndex = Math.min(markets.length, Math.ceil((scrollTop + containerHeight) / ROW_HEIGHT) + OVERSCAN);
  const topSpace = startIndex * ROW_HEIGHT;
  const bottomSpace = Math.max(0, totalHeight - endIndex * ROW_HEIGHT);

  return (
    <div ref={containerRef} className="sm-market-scroll" style={{ height: "calc(100vh - 246px)", minHeight: 420, overflowY: "auto", overflowX: "hidden" }}>
      <div style={{ paddingTop: topSpace, paddingBottom: bottomSpace }}>
        {markets.slice(startIndex, endIndex).map((market) => (
          <MarketRow
            key={market.id}
            market={market}
            active={market.id === selectedId}
            assignedSmId={assignments[market.id] ?? null}
            users={users}
            onSelect={onSelect}
            onAssign={onAssign}
          />
        ))}
      </div>
    </div>
  );
}

function InfoSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 style={{ margin: "0 0 11px", fontSize: 8.5, fontWeight: 750, textTransform: "uppercase", letterSpacing: "0.09em", color: "rgba(0,0,0,0.28)" }}>{label}</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{children}</div>
    </section>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "112px minmax(0,1fr)", gap: 10, alignItems: "start" }}>
      <span style={{ paddingTop: 1, fontSize: 10, fontWeight: 500, color: "rgba(0,0,0,0.4)" }}>{label}</span>
      <span style={{ minWidth: 0, overflowWrap: "anywhere", fontSize: 11, fontWeight: 550, color: value ? "#1a1a1a" : "rgba(0,0,0,0.28)" }}>{value || "—"}</span>
    </div>
  );
}

function MarketDetailDrawer({
  market,
  users,
  assignedSmId,
  onAssign,
  onClose,
}: {
  market: SmMarketPreview;
  users: SMRecord[];
  assignedSmId: string | null;
  onAssign: (smId: string | null) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"info" | "assignments">("info");
  const chain = marketChain(market);
  const colors = chainColors(chain);

  return createPortal(
    <aside style={{ position: "fixed", inset: "0 0 0 auto", zIndex: 8000, width: 430, maxWidth: "calc(100vw - 56px)", display: "flex", flexDirection: "column", background: "#fff", borderLeft: "1px solid rgba(0,0,0,0.08)", boxShadow: "-12px 0 38px rgba(0,0,0,0.08)", animation: "smDrawerIn .18s ease both" }}>
      <div style={{ padding: "14px 16px 12px", borderBottom: "1px solid rgba(0,0,0,0.06)", background: "#fff" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <span style={{ width: 34, height: 34, flexShrink: 0, borderRadius: 9, display: "inline-flex", alignItems: "center", justifyContent: "center", background: colors.background, color: colors.color, fontSize: 9, fontWeight: 800, textTransform: "uppercase" }}>{chain.slice(0, 3)}</span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13, fontWeight: 750, color: "#1a1a1a", letterSpacing: "-0.01em" }}>{market.name}</div>
            <div style={{ marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 9.5, color: "rgba(0,0,0,0.38)", textTransform: "uppercase", letterSpacing: "0.02em" }}>{market.address} · {market.postalCode} {market.city}</div>
          </div>
          <button type="button" onClick={onClose} aria-label="Detailansicht schließen" className="sm-icon-button"><X size={13} strokeWidth={2} /></button>
        </div>
        <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ padding: "3px 7px", borderRadius: 999, background: "rgba(220,38,38,0.06)", color: COKE_RED, fontSize: 8.5, fontWeight: 750 }}>SM Markt</span>
          <span style={{ padding: "3px 7px", borderRadius: 999, background: "rgba(0,0,0,0.035)", color: "rgba(0,0,0,0.48)", fontSize: 8.5, fontWeight: 650 }}>{market.region || "Keine Region"}</span>
          <span style={{ padding: "3px 7px", borderRadius: 999, background: market.isActive ? "rgba(22,163,74,0.07)" : "rgba(0,0,0,0.04)", color: market.isActive ? "#15803d" : "rgba(0,0,0,0.42)", fontSize: 8.5, fontWeight: 700 }}>{market.isActive ? "Aktiv" : "Inaktiv"}</span>
        </div>
      </div>

      <div style={{ display: "flex", gap: 24, padding: "0 16px", background: "#fff", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
        {([
          ["info", "Marktinfo"],
          ["assignments", "Einsätze"],
        ] as const).map(([value, label]) => (
          <button key={value} type="button" onClick={() => setTab(value)} style={{ position: "relative", height: 42, padding: 0, border: "none", background: "transparent", color: tab === value ? COKE_RED : "rgba(0,0,0,0.42)", fontFamily: "inherit", fontSize: 10.5, fontWeight: tab === value ? 700 : 550, cursor: "pointer" }}>
            {label}
            {tab === value ? <span style={{ position: "absolute", right: 0, bottom: -1, left: 0, height: 2, borderRadius: 999, background: COKE_RED }} /> : null}
          </button>
        ))}
      </div>

      <div className="sm-market-scroll" style={{ minHeight: 0, flex: 1, overflowY: "auto", background: "#f5f5f7", padding: "16px" }}>
        {tab === "info" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <InfoSection label="Identität">
              <InfoRow label="Name" value={market.name} />
              <InfoRow label="Name lt. DB" value={market.dbName} />
              <InfoRow label="Interne ID" value={marketInternalId(market)} />
              <InfoRow label="Info" value={market.infoNote} />
            </InfoSection>
            <div className="sm-drawer-divider" />
            <InfoSection label="Standort">
              <InfoRow label="Adresse" value={market.address} />
              <InfoRow label="Postleitzahl" value={market.postalCode} />
              <InfoRow label="Ort" value={market.city} />
              <InfoRow label="Region" value={market.region} />
            </InfoSection>
            <div className="sm-drawer-divider" />
            <InfoSection label="Zuordnung & Klassifikation">
              <div style={{ display: "grid", gridTemplateColumns: "112px minmax(0,1fr)", gap: 10, alignItems: "center" }}>
                <span style={{ fontSize: 10, fontWeight: 500, color: "rgba(0,0,0,0.4)" }}>Stammmarkt von</span>
                <SmAssignmentSelect value={assignedSmId} users={users} onChange={onAssign} />
              </div>
              <InfoRow label="Handelskette" value={marketChain(market)} />
              <InfoRow label="Status" value={<span style={{ color: market.isActive ? "#15803d" : "rgba(0,0,0,0.45)", fontWeight: 700 }}>{market.isActive ? "Aktiv" : "Inaktiv"}</span>} />
            </InfoSection>
          </div>
        ) : (
          <div style={{ minHeight: 280, border: "1px solid rgba(0,0,0,0.06)", borderRadius: 12, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 10, textAlign: "center", padding: 28 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(220,38,38,0.055)", color: COKE_RED, display: "flex", alignItems: "center", justifyContent: "center" }}><Store size={16} strokeWidth={1.7} /></div>
            <div>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: "#1a1a1a" }}>Noch keine SM-Einsätze</div>
              <div style={{ maxWidth: 250, marginTop: 4, fontSize: 10, lineHeight: 1.5, color: "rgba(0,0,0,0.4)" }}>Die spätere Einsatzplanung erscheint hier marktbezogen. In diesem Schritt wird ausschließlich die Markt-UI aufgebaut.</div>
            </div>
          </div>
        )}
      </div>
    </aside>,
    document.body,
  );
}

function PageSkeleton() {
  return (
    <div style={{ border: "1px solid rgba(0,0,0,0.07)", borderRadius: 14, overflow: "hidden", background: "rgba(0,0,0,0.025)" }}>
      <div style={{ height: 42, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 18px" }}>
        <span className="sm-skeleton" style={{ width: 72, height: 9 }} />
        <span className="sm-skeleton" style={{ width: 90, height: 9 }} />
      </div>
      <div style={{ margin: "0 10px 10px", overflow: "hidden", border: "1px solid rgba(0,0,0,0.06)", borderRadius: 12, background: "#fff" }}>
        <div style={{ height: 48, padding: "0 14px", display: "flex", alignItems: "center", gap: 8 }}>
          <span className="sm-skeleton" style={{ width: 200, height: 28 }} />
          <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
            {[60, 70, 62, 84, 62].map((width, index) => <span key={index} className="sm-skeleton" style={{ width, height: 25 }} />)}
          </div>
        </div>
        {Array.from({ length: 11 }).map((_, row) => (
          <div key={row} style={{ height: ROW_HEIGHT, padding: "0 18px", display: "grid", gridTemplateColumns: LIST_GRID, gap: LIST_GAP, alignItems: "center", borderTop: "1px solid rgba(0,0,0,0.04)" }}>
            {Array.from({ length: 9 }).map((__, cell) => <span key={cell} className="sm-skeleton" style={{ width: `${42 + ((row + cell) % 4) * 12}%`, height: 9 }} />)}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SmMaerktePage() {
  const [markets] = useState<SmMarketPreview[]>(TEMP_SM_MARKETS);
  const [users, setUsers] = useState<SMRecord[]>(TEMP_SM_USERS);
  const [assignments, setAssignments] = useState<AssignmentMap>(() => ({
    "sm-market-001": TEMP_SM_USERS[0]?.id ?? null,
    "sm-market-002": TEMP_SM_USERS[0]?.id ?? null,
    "sm-market-003": TEMP_SM_USERS[3]?.id ?? null,
    "sm-market-004": TEMP_SM_USERS[2]?.id ?? null,
    "sm-market-006": TEMP_SM_USERS[3]?.id ?? null,
    "sm-market-008": TEMP_SM_USERS[2]?.id ?? null,
    "sm-market-011": TEMP_SM_USERS[1]?.id ?? null,
    "sm-market-015": TEMP_SM_USERS[1]?.id ?? null,
  }));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [filters, setFilters] = useState<MarketFilters>(EMPTY_FILTERS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const smRows = await fetchSmUsers();
        if (!active || smRows.length === 0) return;
        const sortedUsers = [...smRows].sort((a, b) => formatSmName(a).localeCompare(formatSmName(b), "de-AT", { sensitivity: "base" }));
        setUsers(sortedUsers);
        setAssignments({
          "sm-market-001": sortedUsers[0]?.id ?? null,
          "sm-market-002": sortedUsers[0]?.id ?? null,
          "sm-market-003": sortedUsers[3]?.id ?? sortedUsers[0]?.id ?? null,
          "sm-market-004": sortedUsers[2]?.id ?? sortedUsers[0]?.id ?? null,
          "sm-market-006": sortedUsers[3]?.id ?? sortedUsers[0]?.id ?? null,
          "sm-market-008": sortedUsers[2]?.id ?? sortedUsers[0]?.id ?? null,
          "sm-market-011": sortedUsers[1]?.id ?? sortedUsers[0]?.id ?? null,
          "sm-market-015": sortedUsers[1]?.id ?? sortedUsers[0]?.id ?? null,
        });
      } catch {
        // UI-only preview: keep the temporary SM directory when no backend directory is available.
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  const userById = useMemo(() => new Map(users.map((user) => [user.id, user])), [users]);
  const options = useMemo(() => ({
    region: uniqueSorted(markets.map((market) => market.region)),
    city: uniqueSorted(markets.map((market) => market.city)),
    postalCode: uniqueSorted(markets.map((market) => market.postalCode)),
    chain: uniqueSorted(markets.map((market) => marketChain(market))),
  }), [markets]);

  const filteredMarkets = useMemo(() => {
    const query = normalize(deferredSearch);
    return markets.filter((market) => {
      const assignedSmId = assignments[market.id] ?? null;
      const assignedSm = assignedSmId ? userById.get(assignedSmId) : undefined;
      if (query && !buildSearchText(market, assignedSm).includes(query)) return false;
      if (filters.region && market.region !== filters.region) return false;
      if (filters.city && market.city !== filters.city) return false;
      if (filters.postalCode && market.postalCode !== filters.postalCode) return false;
      if (filters.chain && marketChain(market) !== filters.chain) return false;
      if (filters.smId && assignedSmId !== filters.smId) return false;
      if (filters.status === "Aktiv" && !market.isActive) return false;
      if (filters.status === "Inaktiv" && market.isActive) return false;
      return true;
    });
  }, [assignments, deferredSearch, filters, markets, userById]);

  const selectedMarket = useMemo(() => markets.find((market) => market.id === selectedId) ?? null, [markets, selectedId]);
  const activeFilterCount = Object.values(filters).filter(Boolean).length;
  const assignedCount = useMemo(() => Object.values(assignments).filter(Boolean).length, [assignments]);

  const handleAssignment = useCallback((marketId: string, smId: string | null) => {
    setAssignments((current) => ({ ...current, [marketId]: smId }));
  }, []);

  const setFilter = useCallback(<K extends keyof MarketFilters>(key: K, value: MarketFilters[K]) => {
    setFilters((current) => ({ ...current, [key]: value }));
  }, []);

  const smOptions = useMemo<SelectOption[]>(() => users.map((user) => ({ value: user.id, label: formatSmName(user), subLabel: user.email })), [users]);
  const plainOptions = useCallback((values: string[]): SelectOption[] => values.map((value) => ({ value, label: value })), []);

  return (
    <div style={{ position: "relative" }}>
      <style>{`
        .sm-market-scroll { scrollbar-width: none; }
        .sm-market-scroll::-webkit-scrollbar { display: none; width: 0; height: 0; }
        .sm-market-row { transition: background .1s ease, border-left-color .1s ease; }
        .sm-market-row:hover { background: rgba(220,38,38,0.04) !important; }
        .sm-market-row:focus-visible { box-shadow: inset 0 0 0 2px rgba(220,38,38,0.28); }
        .sm-table-value { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11px; color: #374151; }
        .sm-tabular { font-variant-numeric: tabular-nums; }
        .sm-filter-button { height: 25px; display: inline-flex; align-items: center; gap: 5px; padding: 0 9px; border: 0; border-radius: 6px; box-shadow: inset 0 1px .6px rgba(255,255,255,.9), 0 0 0 1px rgba(0,0,0,.09), 0 1px 3px rgba(0,0,0,.04); font-family: inherit; font-size: 9.5px; font-weight: 600; cursor: pointer; transition: opacity .12s ease; }
        .sm-filter-button:hover, .sm-assignment-button:hover { opacity: .82; }
        .sm-filter-button:focus-visible, .sm-assignment-button:focus-visible, .sm-icon-button:focus-visible { outline: 2px solid rgba(220,38,38,.28); outline-offset: 2px; }
        .sm-select-option { width: 100%; min-height: 31px; padding: 6px 9px; border: 0; border-radius: 6px; display: flex; align-items: center; justify-content: space-between; gap: 10px; font-family: inherit; font-size: 10.5px; cursor: pointer; }
        .sm-select-option:hover { background: rgba(0,0,0,.027) !important; }
        .sm-icon-button { width: 28px; height: 28px; border: 0; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; background: rgba(0,0,0,.035); color: rgba(0,0,0,.42); cursor: pointer; }
        .sm-drawer-divider { height: 1px; background: rgba(0,0,0,.06); }
        .sm-skeleton { display: block; border-radius: 7px; background: linear-gradient(90deg, rgba(0,0,0,.035) 25%, rgba(0,0,0,.075) 37%, rgba(0,0,0,.035) 63%); background-size: 400% 100%; animation: smSkeleton 1.25s ease-in-out infinite; }
        @keyframes smSkeleton { from { background-position: 100% 0; } to { background-position: 0 0; } }
        @keyframes smDrawerIn { from { opacity: 0; transform: translateX(14px); } to { opacity: 1; transform: translateX(0); } }
      `}</style>

      {loading ? <PageSkeleton /> : (
        <div style={{ overflow: "hidden", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 14, background: "rgba(0,0,0,0.025)" }}>
          <div style={{ height: 42, padding: "0 18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 9, fontWeight: 750, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(0,0,0,0.28)" }}>Märkte</span>
              <span style={{ width: 3, height: 3, borderRadius: 999, background: "rgba(0,0,0,0.18)" }} />
              <span style={{ fontSize: 9, fontWeight: 600, color: "rgba(0,0,0,0.34)" }}>Shelf Merchandising</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 9, color: "rgba(0,0,0,0.34)" }}><UsersRound size={10} strokeWidth={1.8} /> {assignedCount} Stammmärkte</span>
              <span style={{ fontSize: 9, color: "rgba(0,0,0,0.34)" }}>{markets.length.toLocaleString("de-AT")} Märkte</span>
            </div>
          </div>

          <div style={{ margin: "0 10px 10px", overflow: "hidden", border: "1px solid rgba(0,0,0,0.06)", borderRadius: 12, background: "#fff", boxShadow: "0 1px 6px rgba(0,0,0,0.05)" }}>
            <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 8, borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ flex: "0 0 210px", height: 28, padding: "0 9px", display: "flex", alignItems: "center", gap: 6, border: "1px solid transparent", borderRadius: 7, background: "rgba(0,0,0,0.03)" }}>
                  <Search size={11} strokeWidth={2} color="rgba(0,0,0,0.3)" />
                  <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Markt suchen…" style={{ minWidth: 0, flex: 1, border: "none", outline: "none", background: "transparent", fontFamily: "inherit", fontSize: 11, color: "#1a1a1a" }} />
                  {search ? <button type="button" onClick={() => setSearch("")} aria-label="Suche leeren" style={{ padding: 0, border: "none", background: "transparent", color: "rgba(0,0,0,0.32)", cursor: "pointer", display: "flex" }}><X size={10} strokeWidth={2} /></button> : null}
                </div>

                <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6, flexWrap: "wrap" }}>
                  <FilterButton label="Region" value={filters.region} options={plainOptions(options.region)} onChange={(value) => setFilter("region", value)} />
                  <FilterButton label="Ort" value={filters.city} options={plainOptions(options.city)} onChange={(value) => setFilter("city", value)} />
                  <FilterButton label="PLZ" value={filters.postalCode} options={plainOptions(options.postalCode)} onChange={(value) => setFilter("postalCode", value)} />
                  <FilterButton label="Handelskette" value={filters.chain} options={plainOptions(options.chain)} onChange={(value) => setFilter("chain", value)} />
                  <FilterButton label="Stamm-SM" value={filters.smId} options={smOptions} onChange={(value) => setFilter("smId", value)} />
                  <FilterButton label="Status" value={filters.status} options={[{ value: "Aktiv", label: "Aktiv" }, { value: "Inaktiv", label: "Inaktiv" }]} onChange={(value) => setFilter("status", value as MarketFilters["status"])} />
                </div>
              </div>

              {activeFilterCount > 0 ? (
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <span style={{ fontSize: 9, fontWeight: 550, color: "rgba(0,0,0,0.36)" }}>{filteredMarkets.length} / {markets.length} Märkte</span>
                  <button type="button" onClick={() => setFilters(EMPTY_FILTERS)} style={{ padding: "2px 7px", border: 0, borderRadius: 5, background: "rgba(220,38,38,0.065)", color: COKE_RED, fontFamily: "inherit", fontSize: 9, fontWeight: 650, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>Filter zurücksetzen <X size={7} strokeWidth={2.5} /></button>
                </div>
              ) : null}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: LIST_GRID, gap: LIST_GAP, padding: "7px 18px", borderBottom: "1px solid rgba(0,0,0,0.05)", background: "rgba(0,0,0,0.018)" }}>
              {["Markt", "Interne ID", "Info", "Adresse", "Region", "PLZ", "Ort", "Stammmarkt von", "Status"].map((label) => (
                <span key={label} style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 8.5, fontWeight: 750, textTransform: "uppercase", letterSpacing: "0.07em", color: "rgba(0,0,0,0.28)" }}>{label}</span>
              ))}
            </div>

            <VirtualMarketList
              markets={filteredMarkets}
              users={users}
              assignments={assignments}
              selectedId={selectedId}
              onSelect={(marketId) => setSelectedId((current) => current === marketId ? null : marketId)}
              onAssign={handleAssignment}
            />
          </div>
        </div>
      )}

      {selectedMarket ? (
        <MarketDetailDrawer
          market={selectedMarket}
          users={users}
          assignedSmId={assignments[selectedMarket.id] ?? null}
          onAssign={(smId) => handleAssignment(selectedMarket.id, smId)}
          onClose={() => setSelectedId(null)}
        />
      ) : null}
    </div>
  );
}
