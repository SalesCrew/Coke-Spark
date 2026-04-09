"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  Search, X, ChevronDown, Check, FileSpreadsheet, Upload, Plus,
  MapPin, Edit2, Save, RotateCcw, Info, Calendar, Clock, User,
  Building2, Tag, ArrowRight,
} from "lucide-react";
import type { MarketRecord, MarketVisitLog, MarketFilters, SectionType } from "@/types/markets";

// ── Constants ─────────────────────────────────────────────────

const R  = "#DC2626";
const RD = "#b91c1c";
const LS_MARKETS = "admin_markets_v1";
const LS_VISITS  = "admin_market_visits_v1";

// ── RED Monat 4/4/5 helper ────────────────────────────────────

function buildRedMonats(): { label: string; start: Date; end: Date }[] {
  const result: { label: string; start: Date; end: Date }[] = [];
  const base = new Date(2024, 0, 1);
  let cur = new Date(base);
  const cycle = [4, 4, 5];
  for (let i = 0; i < 36; i++) {
    const start = new Date(cur);
    const weeks = cycle[i % 3];
    const end = new Date(cur);
    end.setDate(end.getDate() + weeks * 7 - 1);
    result.push({ label: `RED Monat ${i + 1}`, start, end });
    cur.setDate(cur.getDate() + weeks * 7);
  }
  return result;
}

const RED_MONATS = buildRedMonats();

function getCurrentRedMonat(): { label: string; start: Date; end: Date } | null {
  const now = new Date();
  return RED_MONATS.find(rm => now >= rm.start && now <= rm.end) ?? RED_MONATS[RED_MONATS.length - 1];
}

function getRedMonatLabel(date: Date): string {
  const rm = RED_MONATS.find(r => date >= r.start && date <= r.end);
  return rm?.label ?? "";
}

// ── Seed data ─────────────────────────────────────────────────

const SEED_MARKETS: MarketRecord[] = [
  { id: "mk1",  name: "BILLA Wien Favoriten",         dbName: "BIL_FAV_10",   address: "Favoritenstr. 10",       postalCode: "1100", city: "Wien",        region: "Ost",  emEh: "EH", employee: "Thomas Huber",   currentGmName: "Thomas Huber",  visitFrequencyPerYear: 12, infoFlag: false, flexNumber: "10001", cokeMasterNumber: "CK-10001", standardMarketNumber: "SM-001", universeMarket: true,  infoNote: "", ipp: 6.8, importSourceFileName: "Märkte_Q1_2026.xlsx", importedAt: "2026-01-10T08:00:00" },
  { id: "mk2",  name: "BILLA Wien Meidling",          dbName: "BIL_MEI_12",   address: "Meidlinger Hauptstr. 12",postalCode: "1120", city: "Wien",        region: "Ost",  emEh: "EH", employee: "Thomas Huber",   currentGmName: "Thomas Huber",  visitFrequencyPerYear: 12, infoFlag: false, flexNumber: "10002", cokeMasterNumber: "CK-10002", standardMarketNumber: "SM-002", universeMarket: true,  infoNote: "", ipp: 5.4, importSourceFileName: "Märkte_Q1_2026.xlsx", importedAt: "2026-01-10T08:00:00" },
  { id: "mk3",  name: "MERKUR Graz Hauptplatz",       dbName: "MER_GRZ_HP",   address: "Hauptplatz 1",           postalCode: "8010", city: "Graz",        region: "Süd",  emEh: "EH", employee: "Anna Gruber",    currentGmName: "Anna Gruber",   visitFrequencyPerYear: 6,  infoFlag: true,  flexNumber: "20001", cokeMasterNumber: "CK-20001", standardMarketNumber: "SM-003", universeMarket: true,  infoNote: "Saisonale Aktionsfläche neu.", ipp: 7.2, importSourceFileName: "Märkte_Q1_2026.xlsx", importedAt: "2026-01-10T08:00:00" },
  { id: "mk4",  name: "SPAR Linz Nord",               dbName: "SPA_LNZ_N",    address: "Industriezeile 44",      postalCode: "4020", city: "Linz",        region: "West", emEh: "EH", employee: "Michael Huber",  currentGmName: "Michael Huber", visitFrequencyPerYear: 4,  infoFlag: false, flexNumber: "30001", cokeMasterNumber: "CK-30001", standardMarketNumber: "SM-004", universeMarket: false, infoNote: "", ipp: 4.1, importSourceFileName: "Märkte_Q1_2026.xlsx", importedAt: "2026-01-10T08:00:00" },
  { id: "mk5",  name: "BILLA Wien Mariahilf",         dbName: "BIL_MAR_6",    address: "Mariahilfer Str. 58",    postalCode: "1060", city: "Wien",        region: "Ost",  emEh: "EH", employee: "Sandra Mayer",   currentGmName: "Sandra Mayer",  visitFrequencyPerYear: 12, infoFlag: false, flexNumber: "10003", cokeMasterNumber: "CK-10003", standardMarketNumber: "SM-005", universeMarket: true,  infoNote: "", ipp: 6.5, importSourceFileName: "Märkte_Q1_2026.xlsx", importedAt: "2026-01-10T08:00:00" },
  { id: "mk6",  name: "BILLA Mödling",                dbName: "BIL_MOE_22",   address: "Wiener Str. 22",         postalCode: "2340", city: "Mödling",     region: "Ost",  emEh: "EM", employee: "Sandra Mayer",   currentGmName: "Sandra Mayer",  visitFrequencyPerYear: 6,  infoFlag: false, flexNumber: "10004", cokeMasterNumber: "CK-10004", standardMarketNumber: "SM-006", universeMarket: false, infoNote: "", ipp: 3.8, importSourceFileName: "Märkte_Q1_2026.xlsx", importedAt: "2026-01-10T08:00:00" },
  { id: "mk7",  name: "MERKUR Wien Donaustadt",       dbName: "MER_DON_22",   address: "Donaustadtstr. 7",       postalCode: "1220", city: "Wien",        region: "Ost",  emEh: "EH", employee: "Klaus Berger",   currentGmName: "Klaus Berger",  visitFrequencyPerYear: 12, infoFlag: false, flexNumber: "20002", cokeMasterNumber: "CK-20002", standardMarketNumber: "SM-007", universeMarket: true,  infoNote: "", ipp: 7.8, importSourceFileName: "Märkte_Q1_2026.xlsx", importedAt: "2026-01-10T08:00:00" },
  { id: "mk8",  name: "SPAR Graz West",               dbName: "SPA_GRZ_W",    address: "Westring 381",           postalCode: "8051", city: "Graz",        region: "Süd",  emEh: "EH", employee: "Anna Gruber",    currentGmName: "Anna Gruber",   visitFrequencyPerYear: 6,  infoFlag: false, flexNumber: "30002", cokeMasterNumber: "CK-30002", standardMarketNumber: "SM-008", universeMarket: true,  infoNote: "", ipp: 6.1, importSourceFileName: "Märkte_Q1_2026.xlsx", importedAt: "2026-01-10T08:00:00" },
  { id: "mk9",  name: "BILLA Baden",                  dbName: "BIL_BAD_5",    address: "Kaiser Franz-Josef Ring 5", postalCode: "2500", city: "Baden",    region: "Ost",  emEh: "EM", employee: "Sandra Mayer",   currentGmName: "Sandra Mayer",  visitFrequencyPerYear: 4,  infoFlag: true,  flexNumber: "10005", cokeMasterNumber: "CK-10005", standardMarketNumber: "SM-009", universeMarket: false, infoNote: "Kühler 3 defekt, Wartung angefordert.", ipp: 4.5, importSourceFileName: "Märkte_Q1_2026.xlsx", importedAt: "2026-01-10T08:00:00" },
  { id: "mk10", name: "MERKUR Salzburg Europark",     dbName: "MER_SAL_EP",   address: "Europark Allee 1",       postalCode: "5020", city: "Salzburg",    region: "West", emEh: "EH", employee: "Michael Huber",  currentGmName: "Michael Huber", visitFrequencyPerYear: 6,  infoFlag: false, flexNumber: "20003", cokeMasterNumber: "CK-20003", standardMarketNumber: "SM-010", universeMarket: false, infoNote: "", ipp: 5.9, importSourceFileName: "Märkte_Q1_2026.xlsx", importedAt: "2026-01-10T08:00:00" },
  { id: "mk11", name: "BILLA Wien Schönbrunn",        dbName: "BIL_SCH_15",   address: "Schönbrunner Str. 131",  postalCode: "1050", city: "Wien",        region: "Ost",  emEh: "EH", employee: "Thomas Huber",   currentGmName: "Thomas Huber",  visitFrequencyPerYear: 12, infoFlag: false, flexNumber: "10006", cokeMasterNumber: "CK-10006", standardMarketNumber: "SM-011", universeMarket: true,  infoNote: "", ipp: 7.1, importSourceFileName: "Märkte_Q1_2026.xlsx", importedAt: "2026-01-10T08:00:00" },
  { id: "mk12", name: "SPAR Wels Stadtplatz",         dbName: "SPA_WEL_SP",   address: "Stadtplatz 12",          postalCode: "4600", city: "Wels",        region: "West", emEh: "EH", employee: "Klaus Berger",   currentGmName: "Klaus Berger",  visitFrequencyPerYear: 6,  infoFlag: false, flexNumber: "30003", cokeMasterNumber: "CK-30003", standardMarketNumber: "SM-012", universeMarket: false, infoNote: "", ipp: 6.3, importSourceFileName: "Märkte_Q1_2026.xlsx", importedAt: "2026-01-10T08:00:00" },
  { id: "mk13", name: "BILLA Klagenfurt",             dbName: "BIL_KLG_27",   address: "Völkermarkter Str. 27",  postalCode: "9020", city: "Klagenfurt",  region: "Süd",  emEh: "EH", employee: "Anna Gruber",    currentGmName: "Anna Gruber",   visitFrequencyPerYear: 4,  infoFlag: false, flexNumber: "10007", cokeMasterNumber: "CK-10007", standardMarketNumber: "SM-013", universeMarket: false, infoNote: "", ipp: 3.2, importSourceFileName: "Märkte_Q1_2026.xlsx", importedAt: "2026-01-10T08:00:00" },
  { id: "mk14", name: "MERKUR Innsbruck",             dbName: "MER_INN_38",   address: "Museumstr. 38",          postalCode: "6020", city: "Innsbruck",   region: "Nord", emEh: "EH", employee: "Klaus Berger",   currentGmName: "Klaus Berger",  visitFrequencyPerYear: 6,  infoFlag: false, flexNumber: "20004", cokeMasterNumber: "CK-20004", standardMarketNumber: "SM-014", universeMarket: true,  infoNote: "", ipp: 5.7, importSourceFileName: "Märkte_Q1_2026.xlsx", importedAt: "2026-01-10T08:00:00" },
  { id: "mk15", name: "BILLA Wien Landstraße",        dbName: "BIL_LAN_3",    address: "Landstr. Hauptstr. 44",  postalCode: "1030", city: "Wien",        region: "Ost",  emEh: "EH", employee: "Anna Fuchs",     currentGmName: "Anna Fuchs",    visitFrequencyPerYear: 12, infoFlag: false, flexNumber: "10008", cokeMasterNumber: "CK-10008", standardMarketNumber: "SM-015", universeMarket: true,  infoNote: "", ipp: 7.4, importSourceFileName: "Märkte_Q1_2026.xlsx", importedAt: "2026-01-10T08:00:00" },
  { id: "mk16", name: "SPAR St. Pölten Rathaus",      dbName: "SPA_STP_RP",   address: "Rathausplatz 8",         postalCode: "3100", city: "St. Pölten",  region: "Ost",  emEh: "EH", employee: "Anna Fuchs",     currentGmName: "Anna Fuchs",    visitFrequencyPerYear: 6,  infoFlag: false, flexNumber: "30004", cokeMasterNumber: "CK-30004", standardMarketNumber: "SM-016", universeMarket: false, infoNote: "", ipp: 6.9, importSourceFileName: "Märkte_Q1_2026.xlsx", importedAt: "2026-01-10T08:00:00" },
  { id: "mk17", name: "BILLA Salzburg Mitte",         dbName: "BIL_SAL_GM",   address: "Getreidegasse 10",       postalCode: "5020", city: "Salzburg",    region: "West", emEh: "EM", employee: "Michael Huber",  currentGmName: "Michael Huber", visitFrequencyPerYear: 4,  infoFlag: false, flexNumber: "10009", cokeMasterNumber: "CK-10009", standardMarketNumber: "SM-017", universeMarket: false, infoNote: "", ipp: 4.8, importSourceFileName: "Märkte_Q1_2026.xlsx", importedAt: "2026-01-10T08:00:00" },
  { id: "mk18", name: "MERKUR Villach",               dbName: "MER_VIL_HG",   address: "Hans-Gasser-Platz 3",    postalCode: "9500", city: "Villach",     region: "Süd",  emEh: "EH", employee: "Anna Gruber",    currentGmName: "Anna Gruber",   visitFrequencyPerYear: 4,  infoFlag: false, flexNumber: "20005", cokeMasterNumber: "CK-20005", standardMarketNumber: "SM-018", universeMarket: false, infoNote: "", ipp: 3.6, importSourceFileName: "Märkte_Q1_2026.xlsx", importedAt: "2026-01-10T08:00:00" },
  { id: "mk19", name: "SPAR Innsbruck Ost",           dbName: "SPA_INN_OS",   address: "Pradler Str. 66",        postalCode: "6020", city: "Innsbruck",   region: "Nord", emEh: "EH", employee: "Klaus Berger",   currentGmName: "Klaus Berger",  visitFrequencyPerYear: 6,  infoFlag: true,  flexNumber: "30005", cokeMasterNumber: "CK-30005", standardMarketNumber: "SM-019", universeMarket: false, infoNote: "Umbau geplant Q3.", ipp: 5.2, importSourceFileName: "Märkte_Q1_2026.xlsx", importedAt: "2026-01-10T08:00:00" },
  { id: "mk20", name: "BILLA Bregenz",                dbName: "BIL_BRE_19",   address: "Kirchstr. 19",           postalCode: "6900", city: "Bregenz",     region: "Nord", emEh: "EM", employee: "Klaus Berger",   currentGmName: "Klaus Berger",  visitFrequencyPerYear: 4,  infoFlag: false, flexNumber: "10010", cokeMasterNumber: "CK-10010", standardMarketNumber: "SM-020", universeMarket: false, infoNote: "", ipp: 4.3, importSourceFileName: "Märkte_Q1_2026.xlsx", importedAt: "2026-01-10T08:00:00" },
  { id: "mk21", name: "SPAR Steyr",                   dbName: "SPA_STE_SP",   address: "Stadtplatz 14",          postalCode: "4400", city: "Steyr",       region: "West", emEh: "EH", employee: "Michael Huber",  currentGmName: "Michael Huber", visitFrequencyPerYear: 4,  infoFlag: false, flexNumber: "30006", cokeMasterNumber: "CK-30006", standardMarketNumber: "SM-021", universeMarket: false, infoNote: "", ipp: 6.0, importSourceFileName: "Märkte_Q1_2026.xlsx", importedAt: "2026-01-10T08:00:00" },
  { id: "mk22", name: "BILLA Eisenstadt",             dbName: "BIL_EIS_DP",   address: "Domplatz 11",            postalCode: "7000", city: "Eisenstadt",  region: "Ost",  emEh: "EM", employee: "Anna Fuchs",     currentGmName: "Anna Fuchs",    visitFrequencyPerYear: 4,  infoFlag: false, flexNumber: "10011", cokeMasterNumber: "CK-10011", standardMarketNumber: "SM-022", universeMarket: false, infoNote: "", ipp: 5.5, importSourceFileName: "Märkte_Q1_2026.xlsx", importedAt: "2026-01-10T08:00:00" },
  { id: "mk23", name: "MERKUR Linz Mitte",            dbName: "MER_LNZ_HR",   address: "Herrenstr. 9",           postalCode: "4020", city: "Linz",        region: "West", emEh: "EH", employee: "Michael Huber",  currentGmName: "Michael Huber", visitFrequencyPerYear: 6,  infoFlag: false, flexNumber: "20006", cokeMasterNumber: "CK-20006", standardMarketNumber: "SM-023", universeMarket: true,  infoNote: "", ipp: 7.3, importSourceFileName: "Märkte_Q1_2026.xlsx", importedAt: "2026-01-10T08:00:00" },
  { id: "mk24", name: "SPAR Wien Mitte",              dbName: "SPA_WIE_LH",   address: "Landstr. Hauptstr. 1b",  postalCode: "1030", city: "Wien",        region: "Ost",  emEh: "EH", employee: "Thomas Huber",   currentGmName: "Thomas Huber",  visitFrequencyPerYear: 12, infoFlag: false, flexNumber: "30007", cokeMasterNumber: "CK-30007", standardMarketNumber: "SM-024", universeMarket: true,  infoNote: "", ipp: 6.7, importSourceFileName: "Märkte_Q1_2026.xlsx", importedAt: "2026-01-10T08:00:00" },
];

function buildSeedVisits(): MarketVisitLog[] {
  const visits: MarketVisitLog[] = [];
  const sections: Array<{ type: SectionType; fbName: string }> = [
    { type: "standard", fbName: "Standardbesuch KW12" },
    { type: "flex",     fbName: "Flexbesuch April" },
    { type: "kuehler",  fbName: "Kühlerinventur März" },
    { type: "mhd",      fbName: "MHD Kontrolle KW11" },
    { type: "billa",    fbName: "Billa Frühjahr 2026" },
  ];
  const visitDates: Array<{ marketId: string; iso: string; gm: string; dur: number; sec: number }> = [
    { marketId: "mk1",  iso: "2026-02-25T09:14:00", gm: "Thomas Huber",  dur: 34, sec: 0 },
    { marketId: "mk1",  iso: "2026-02-25T10:30:00", gm: "Thomas Huber",  dur: 18, sec: 2 },
    { marketId: "mk1",  iso: "2026-02-25T11:05:00", gm: "Thomas Huber",  dur: 12, sec: 3 },
    { marketId: "mk1",  iso: "2026-01-22T10:05:00", gm: "Thomas Huber",  dur: 29, sec: 2 },
    { marketId: "mk2",  iso: "2026-02-25T11:02:00", gm: "Thomas Huber",  dur: 28, sec: 0 },
    { marketId: "mk3",  iso: "2026-02-20T09:30:00", gm: "Anna Gruber",   dur: 41, sec: 0 },
    { marketId: "mk3",  iso: "2026-02-20T11:00:00", gm: "Anna Gruber",   dur: 22, sec: 3 },
    { marketId: "mk3",  iso: "2026-02-20T11:35:00", gm: "Anna Gruber",   dur: 14, sec: 2 },
    { marketId: "mk3",  iso: "2025-11-10T08:00:00", gm: "Anna Gruber",   dur: 38, sec: 3 },
    { marketId: "mk5",  iso: "2026-02-26T08:47:00", gm: "Sandra Mayer",  dur: 41, sec: 0 },
    { marketId: "mk5",  iso: "2026-02-26T10:15:00", gm: "Sandra Mayer",  dur: 21, sec: 3 },
    { marketId: "mk5",  iso: "2026-01-08T14:00:00", gm: "Sandra Mayer",  dur: 32, sec: 4 },
    { marketId: "mk7",  iso: "2026-02-26T13:30:00", gm: "Klaus Berger",  dur: 22, sec: 0 },
    { marketId: "mk7",  iso: "2026-02-26T14:50:00", gm: "Klaus Berger",  dur: 15, sec: 2 },
    { marketId: "mk7",  iso: "2026-02-10T09:10:00", gm: "Klaus Berger",  dur: 19, sec: 2 },
    { marketId: "mk8",  iso: "2026-02-24T10:15:00", gm: "Anna Gruber",   dur: 37, sec: 0 },
    { marketId: "mk8",  iso: "2026-02-24T11:45:00", gm: "Anna Gruber",   dur: 16, sec: 2 },
    { marketId: "mk11", iso: "2026-02-27T09:00:00", gm: "Thomas Huber",  dur: 30, sec: 0 },
    { marketId: "mk11", iso: "2026-02-27T10:10:00", gm: "Thomas Huber",  dur: 13, sec: 3 },
    { marketId: "mk12", iso: "2026-02-27T14:20:00", gm: "Klaus Berger",  dur: 25, sec: 0 },
    { marketId: "mk14", iso: "2025-12-15T10:45:00", gm: "Klaus Berger",  dur: 33, sec: 1 },
    { marketId: "mk15", iso: "2026-02-28T08:30:00", gm: "Anna Fuchs",    dur: 45, sec: 0 },
    { marketId: "mk15", iso: "2026-02-28T09:45:00", gm: "Anna Fuchs",    dur: 16, sec: 2 },
    { marketId: "mk16", iso: "2026-02-28T11:55:00", gm: "Anna Fuchs",    dur: 19, sec: 0 },
    { marketId: "mk23", iso: "2026-02-22T15:00:00", gm: "Michael Huber", dur: 27, sec: 0 },
    { marketId: "mk24", iso: "2026-02-19T11:30:00", gm: "Thomas Huber",  dur: 31, sec: 1 },
    { marketId: "mk4",  iso: "2026-02-25T14:00:00", gm: "Michael Huber", dur: 29, sec: 0 },
    { marketId: "mk4",  iso: "2026-02-25T15:10:00", gm: "Michael Huber", dur: 14, sec: 2 },
    { marketId: "mk6",  iso: "2026-02-27T10:30:00", gm: "Sandra Mayer",  dur: 24, sec: 0 },
    { marketId: "mk10", iso: "2026-02-26T09:00:00", gm: "Michael Huber", dur: 33, sec: 0 },
    { marketId: "mk13", iso: "2026-02-28T13:00:00", gm: "Anna Gruber",   dur: 22, sec: 0 },
    { marketId: "mk13", iso: "2026-02-28T14:20:00", gm: "Anna Gruber",   dur: 11, sec: 3 },
    // Current RED Monat (April 2026) visits — so Besucht/Nicht besucht filter works
    { marketId: "mk1",  iso: "2026-04-02T09:00:00", gm: "Thomas Huber",  dur: 36, sec: 0 },
    { marketId: "mk1",  iso: "2026-04-02T10:25:00", gm: "Thomas Huber",  dur: 17, sec: 2 },
    { marketId: "mk2",  iso: "2026-04-02T11:30:00", gm: "Thomas Huber",  dur: 26, sec: 0 },
    { marketId: "mk3",  iso: "2026-04-04T09:15:00", gm: "Anna Gruber",   dur: 44, sec: 0 },
    { marketId: "mk3",  iso: "2026-04-04T11:00:00", gm: "Anna Gruber",   dur: 20, sec: 3 },
    { marketId: "mk5",  iso: "2026-04-03T08:30:00", gm: "Sandra Mayer",  dur: 38, sec: 0 },
    { marketId: "mk7",  iso: "2026-04-05T13:00:00", gm: "Klaus Berger",  dur: 24, sec: 0 },
    { marketId: "mk7",  iso: "2026-04-05T14:10:00", gm: "Klaus Berger",  dur: 13, sec: 2 },
    { marketId: "mk8",  iso: "2026-04-03T10:00:00", gm: "Anna Gruber",   dur: 35, sec: 0 },
    { marketId: "mk11", iso: "2026-04-06T09:00:00", gm: "Thomas Huber",  dur: 31, sec: 0 },
    { marketId: "mk15", iso: "2026-04-07T08:30:00", gm: "Anna Fuchs",    dur: 42, sec: 0 },
    { marketId: "mk15", iso: "2026-04-07T09:45:00", gm: "Anna Fuchs",    dur: 14, sec: 2 },
    { marketId: "mk23", iso: "2026-04-04T15:00:00", gm: "Michael Huber", dur: 28, sec: 0 },
  ];
  visitDates.forEach((v, i) => {
    const d = new Date(v.iso);
    const s = sections[v.sec % sections.length];
    visits.push({
      id: `vl${i + 1}`,
      marketId: v.marketId,
      sectionType: s.type,
      fragebogenName: s.fbName,
      gmName: v.gm,
      visitedAt: v.iso,
      durationMin: v.dur,
      redMonatLabel: getRedMonatLabel(d),
    });
  });
  return visits;
}

// ── Utility helpers ────────────────────────────────────────────

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("de-AT", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function fmtTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("de-AT", { hour: "2-digit", minute: "2-digit" });
}
function chainInitials(name: string): { bg: string; text: string } {
  const n = name.toUpperCase();
  if (n.includes("BILLA")) return { bg: "rgba(234,179,8,0.12)", text: "#a16207" };
  if (n.includes("SPAR"))  return { bg: "rgba(220,38,38,0.08)", text: "#DC2626" };
  if (n.includes("MERKUR"))return { bg: "rgba(59,130,246,0.08)", text: "#2563eb" };
  if (n.includes("PENNY")) return { bg: "rgba(194,65,12,0.08)", text: "#c2410c" };
  if (n.includes("HOFER")) return { bg: "rgba(16,185,129,0.08)", text: "#065f46" };
  if (n.includes("ADEG"))  return { bg: "rgba(34,197,94,0.08)", text: "#15803d" };
  return { bg: "rgba(0,0,0,0.05)", text: "#6b7280" };
}

const SECTION_META: Record<SectionType, { label: string; color: string; bg: string }> = {
  standard: { label: "Standard",  color: "#DC2626", bg: "rgba(220,38,38,0.07)"   },
  flex:     { label: "Flex",      color: "#65a30d", bg: "rgba(132,204,22,0.07)"  },
  kuehler:  { label: "Kühler",    color: "#D97706", bg: "rgba(245,158,11,0.07)"  },
  mhd:      { label: "MHD",       color: "#7C3AED", bg: "rgba(124,58,237,0.07)"  },
  billa:    { label: "Billa",     color: "#0891B2", bg: "rgba(8,145,178,0.07)"   },
};

// ── Frequency circle ──────────────────────────────────────────

function FrequencyCircle({ visited, frequency, visitedThisMonth, size = 36 }: {
  visited: number; frequency: number; visitedThisMonth: boolean; size?: number;
}) {
  const r = 14;
  const circ = 2 * Math.PI * r;
  const pct = frequency > 0 ? Math.min(1, visited / frequency) : 0;
  const strokeColor = visitedThisMonth ? "#16a34a" : R;
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <svg viewBox="0 0 36 36" width={size} height={size} style={{ position: "absolute", transform: "rotate(-90deg)" }}>
        <circle cx={18} cy={18} r={r} fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth={2.5} />
        <circle cx={18} cy={18} r={r} fill="none" stroke={strokeColor} strokeWidth={2.5}
          strokeLinecap="round" strokeDasharray={`${pct * circ} ${circ}`} />
      </svg>
      <span style={{ fontSize: 7.5, fontWeight: 700, color: "#374151", fontVariantNumeric: "tabular-nums", position: "relative", zIndex: 1, letterSpacing: "-0.02em" }}>
        {visited}/{frequency}
      </span>
    </div>
  );
}

// ── Import Modal ──────────────────────────────────────────────

const IMPORT_FIELDS = [
  "Flex-nummer","Stammnr. von Coke","Standardmarkt Nr","Name","Adresse",
  "Postleitzahl","Ort","Name f. DB","EM/EH","Region","Mitarbeiter",
  "Universums-markt","Besuchsrhythmus in Uni","Info",
];

function ImportModal({ onImport, onClose }: { onImport: () => void; onClose: () => void }) {
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setMounted(true); }, []);

  const handleFile = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const f = files[0];
    if (f.name.endsWith(".xlsx") || f.name.endsWith(".xls")) {
      setFileName(f.name);
    }
  };

  if (!mounted || typeof document === "undefined") return null;
  return createPortal(
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 9000, background: "rgba(0,0,0,0.22)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <style>{`@keyframes imIn{from{opacity:0;transform:scale(0.96)translateY(10px)}to{opacity:1;transform:scale(1)translateY(0)}}`}</style>
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 520, background: "#fff", borderRadius: 18, boxShadow: "0 24px 60px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.08)", overflow: "hidden", animation: "imIn 0.22s cubic-bezier(0.4,0,0.2,1) both" }}>

        {/* Header */}
        <div style={{ padding: "18px 22px", borderBottom: "1px solid rgba(0,0,0,0.06)", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: "rgba(220,38,38,0.08)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <FileSpreadsheet size={16} strokeWidth={1.8} color={R} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a", letterSpacing: "-0.02em" }}>Märkte importieren</div>
            <div style={{ fontSize: 10, color: "rgba(0,0,0,0.38)", fontWeight: 500, marginTop: 1 }}>Excel-Import vorbereitet · v1 lädt Testdaten</div>
          </div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 8, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.05)", color: "rgba(0,0,0,0.4)", transition: "background 0.12s ease" }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(0,0,0,0.09)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(0,0,0,0.05)"; }}>
            <X size={13} strokeWidth={2.5} />
          </button>
        </div>

        <div style={{ padding: "20px 22px", display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files); }}
            onClick={() => fileRef.current?.click()}
            style={{ border: `2px dashed ${dragging ? R : fileName ? "#16a34a" : "rgba(0,0,0,0.10)"}`, borderRadius: 12, padding: "32px 20px", background: dragging ? "rgba(220,38,38,0.03)" : fileName ? "rgba(22,163,74,0.03)" : "rgba(0,0,0,0.012)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, cursor: "pointer", transition: "all 0.18s ease", textAlign: "center" }}>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: "none" }} onChange={e => handleFile(e.target.files)} />
            <div style={{ width: 44, height: 44, borderRadius: 11, background: fileName ? "rgba(22,163,74,0.1)" : dragging ? "rgba(220,38,38,0.07)" : "rgba(0,0,0,0.045)", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }}>
              <FileSpreadsheet size={20} strokeWidth={1.5} color={fileName ? "#16a34a" : dragging ? R : "rgba(0,0,0,0.28)"} />
            </div>
            {fileName ? (
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#16a34a", marginBottom: 3 }}>{fileName}</div>
                <div style={{ fontSize: 10, color: "rgba(0,0,0,0.35)" }}>Datei ausgewählt · Parser-Anbindung kommt in v2</div>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: dragging ? R : "#1a1a1a", marginBottom: 3 }}>Excel-Datei hier ablegen</div>
                <div style={{ fontSize: 10, color: "rgba(0,0,0,0.35)" }}>oder klicken zum Auswählen · .xlsx, .xls</div>
              </div>
            )}
          </div>

          {/* Mapped fields strip */}
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(0,0,0,0.3)", marginBottom: 8 }}>Importierte Felder</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {IMPORT_FIELDS.map(f => (
                <span key={f} style={{ fontSize: 9, fontWeight: 600, padding: "3px 8px", borderRadius: 5, background: "rgba(0,0,0,0.04)", color: "rgba(0,0,0,0.5)", border: "1px solid rgba(0,0,0,0.06)" }}>{f}</span>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", paddingTop: 4 }}>
            <button onClick={onClose} style={{ padding: "8px 16px", fontSize: 11, fontWeight: 600, borderRadius: 8, border: "1px solid rgba(0,0,0,0.09)", cursor: "pointer", color: "rgba(0,0,0,0.45)", background: "linear-gradient(to bottom,#fff,#f5f5f5)", boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.9),0 0 0 1px rgba(0,0,0,0.09),0 1px 4px rgba(0,0,0,0.05)", transition: "opacity 0.15s" }}
              onMouseEnter={e => { e.currentTarget.style.opacity = "0.75"; }} onMouseLeave={e => { e.currentTarget.style.opacity = "1"; }}>
              Abbrechen
            </button>
            <button onClick={onImport} style={{ padding: "8px 18px", fontSize: 11, fontWeight: 700, borderRadius: 8, border: "none", cursor: "pointer", color: "#fff", background: `linear-gradient(to bottom, ${R}, ${RD})`, boxShadow: `inset 0 1px 0.6px rgba(255,255,255,0.33),inset 0 -1px 0 rgba(255,255,255,0.15),0 0 0 1px #a91b1b,0 1px 6px rgba(180,20,20,0.14)`, display: "flex", alignItems: "center", gap: 6, transition: "opacity 0.15s" }}
              onMouseEnter={e => { e.currentTarget.style.opacity = "0.9"; }} onMouseLeave={e => { e.currentTarget.style.opacity = "1"; }}>
              <Upload size={11} strokeWidth={2} />
              Testdaten laden
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Filter dropdown ────────────────────────────────────────────

function FilterDropdown({ options, value, onChange, onClose, anchorRef, nullLabel = "Alle" }: {
  options: string[]; value: string | null;
  onChange: (v: string | null) => void; onClose: () => void;
  anchorRef: React.RefObject<HTMLButtonElement>;
  nullLabel?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    function updatePos() {
      if (!anchorRef.current) return;
      const r = anchorRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, left: r.left });
    }
    updatePos();
    window.addEventListener("scroll", updatePos, true);
    window.addEventListener("resize", updatePos);
    return () => {
      window.removeEventListener("scroll", updatePos, true);
      window.removeEventListener("resize", updatePos);
    };
  }, [anchorRef]);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node) &&
          anchorRef.current && !anchorRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [onClose, anchorRef]);

  if (!pos || typeof document === "undefined") return null;
  return createPortal(
    <div ref={ref} className="map-scroll" style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 9999, background: "#fff", borderRadius: 9, border: "1px solid rgba(0,0,0,0.08)", boxShadow: "0 6px 20px rgba(0,0,0,0.10)", padding: 4, minWidth: 160, maxHeight: 480, overflowY: "auto" }}>
      <button onClick={() => { onChange(null); onClose(); }}
        style={{ width: "100%", textAlign: "left", padding: "6px 10px", fontSize: 11, borderRadius: 5, border: "none", cursor: "pointer", background: !value ? "rgba(220,38,38,0.06)" : "transparent", color: !value ? R : "#374151", fontWeight: !value ? 600 : 400, fontFamily: "inherit" }}
        onMouseEnter={e => { if (value) e.currentTarget.style.background = "rgba(0,0,0,0.025)"; }}
        onMouseLeave={e => { if (value) e.currentTarget.style.background = "transparent"; }}>
        {nullLabel}
      </button>
      {options.map(opt => (
        <button key={opt} onClick={() => { onChange(opt); onClose(); }}
          style={{ width: "100%", textAlign: "left", padding: "6px 10px", fontSize: 11, borderRadius: 5, border: "none", cursor: "pointer", background: value === opt ? "rgba(220,38,38,0.06)" : "transparent", color: value === opt ? R : "#374151", fontWeight: value === opt ? 600 : 400, fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "space-between" }}
          onMouseEnter={e => { if (value !== opt) e.currentTarget.style.background = "rgba(0,0,0,0.025)"; }}
          onMouseLeave={e => { if (value !== opt) e.currentTarget.style.background = "transparent"; }}>
          {opt}
          {value === opt && <Check size={11} strokeWidth={2.5} color={R} />}
        </button>
      ))}
    </div>,
    document.body
  );
}

// ── Info section for detail drawer ────────────────────────────

function InfoSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 8.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.09em", color: "rgba(0,0,0,0.28)", marginBottom: 10 }}>{label}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>{children}</div>
    </div>
  );
}

function InfoRow({ label, value, edit, editValue, onEdit }: {
  label: string; value: string | React.ReactNode; edit?: boolean;
  editValue?: string; onEdit?: (v: string) => void;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 8, alignItems: "flex-start" }}>
      <span style={{ fontSize: 10, fontWeight: 500, color: "rgba(0,0,0,0.4)", paddingTop: 1 }}>{label}</span>
      {edit && onEdit !== undefined ? (
        <input value={editValue ?? ""} onChange={e => onEdit(e.target.value)}
          style={{ fontSize: 11, fontWeight: 500, color: "#1a1a1a", border: "1px solid rgba(0,0,0,0.12)", borderRadius: 6, padding: "4px 8px", outline: "none", background: "#fff", width: "100%", boxSizing: "border-box", fontFamily: "inherit" }} />
      ) : (
        <span style={{ fontSize: 11, fontWeight: 500, color: value ? "#1a1a1a" : "rgba(0,0,0,0.28)" }}>{value || "—"}</span>
      )}
    </div>
  );
}

// ── Visit session card ────────────────────────────────────────

function VisitCard({ logs }: { logs: MarketVisitLog[] }) {
  const [expanded, setExpanded] = useState(false);
  const sorted = [...logs].sort((a, b) => new Date(a.visitedAt).getTime() - new Date(b.visitedAt).getTime());
  const primary = sorted[0];
  const isFlexVisit = sorted.some(l => l.sectionType === "flex");
  const visitType   = isFlexVisit ? "Flexbesuch" : "Standardbesuch";
  const vtColor     = isFlexVisit
    ? { color: "#65a30d", bg: "rgba(132,204,22,0.09)", border: "rgba(132,204,22,0.22)" }
    : { color: R,        bg: "rgba(220,38,38,0.07)",  border: "rgba(220,38,38,0.18)" };
  const totalDuration = sorted.reduce((n, l) => n + l.durationMin, 0);

  return (
    <div
      onClick={() => setExpanded(e => !e)}
      style={{ background: "#fff", borderRadius: 12, border: "1px solid rgba(0,0,0,0.07)", boxShadow: expanded ? "0 4px 18px rgba(0,0,0,0.07)" : "0 1px 5px rgba(0,0,0,0.04)", cursor: "pointer", overflow: "hidden", transition: "box-shadow 0.22s ease" }}
      onMouseEnter={e => { if (!expanded) (e.currentTarget as HTMLElement).style.boxShadow = "0 3px 12px rgba(0,0,0,0.07)"; }}
      onMouseLeave={e => { if (!expanded) (e.currentTarget as HTMLElement).style.boxShadow = "0 1px 5px rgba(0,0,0,0.04)"; }}
    >
      {/* Collapsed header */}
      <div style={{ padding: "11px 14px", display: "flex", alignItems: "center", gap: 10 }}>

        {/* Visit type pill — border radius matches card (12 → 7) */}
        <span style={{ fontSize: 9, fontWeight: 700, padding: "3px 9px", borderRadius: 7, background: vtColor.bg, color: vtColor.color, border: `1px solid ${vtColor.border}`, letterSpacing: "0.02em", flexShrink: 0, whiteSpace: "nowrap" }}>
          {visitType}
        </span>

        {/* Section dots — overlapping like avatar stack */}
        <div style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
          {sorted.map((l, i) => {
            const sm = SECTION_META[l.sectionType];
            return <span key={l.id} title={sm.label} style={{ width: 9, height: 9, borderRadius: "50%", background: sm.color, border: "1.5px solid #fff", display: "inline-block", marginLeft: i === 0 ? 0 : -4, flexShrink: 0 }} />;
          })}
        </div>

        <div style={{ flex: 1 }} />

        {/* Meta: date · time · duration, then GM · RED Monat · chevron */}
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: "#1a1a1a", whiteSpace: "nowrap" }}>
            {fmtDate(primary.visitedAt)} · {fmtTime(primary.visitedAt)} Uhr · {totalDuration} Min
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 7, marginTop: 2 }}>
            <span style={{ fontSize: 9, color: "rgba(0,0,0,0.4)", fontWeight: 500 }}>{primary.gmName}</span>
            {primary.redMonatLabel && <span style={{ fontSize: 8, color: "rgba(0,0,0,0.26)", fontWeight: 500 }}>{primary.redMonatLabel}</span>}
            <ChevronDown size={11} strokeWidth={2} color="rgba(0,0,0,0.28)"
              style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.26s cubic-bezier(0.4,0,0.2,1)", flexShrink: 0 }} />
          </div>
        </div>
      </div>

      {/* Expandable body */}
      <div style={{ maxHeight: expanded ? "400px" : "0", overflow: "hidden", transition: "max-height 0.3s cubic-bezier(0.4,0,0.2,1)" }}>
        <div style={{ opacity: expanded ? 1 : 0, transform: expanded ? "translateY(0)" : "translateY(-5px)", transition: "opacity 0.2s ease 0.06s, transform 0.2s ease 0.06s", borderTop: "1px solid rgba(0,0,0,0.05)", padding: "9px 12px", display: "flex", flexDirection: "column", gap: 5 }}>
          {sorted.map(l => {
            const sm = SECTION_META[l.sectionType];
            return (
              <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 11px", borderRadius: 8, background: "rgba(0,0,0,0.025)" }}>
                <span style={{ fontSize: 8.5, fontWeight: 700, padding: "2px 9px", borderRadius: 6, background: sm.bg, color: sm.color, border: `1px solid ${sm.color}28`, letterSpacing: "0.03em", flexShrink: 0, whiteSpace: "nowrap" }}>
                  {sm.label}
                </span>
                <span style={{ fontSize: 11, fontWeight: 600, color: "#1a1a1a", flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {l.fragebogenName}
                </span>
                <span style={{ fontSize: 9, color: "rgba(0,0,0,0.38)", whiteSpace: "nowrap", flexShrink: 0 }}>
                  {fmtTime(l.visitedAt)} · {l.durationMin} Min
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Market Detail Drawer ───────────────────────────────────────

function MarketDetailDrawer({ market, visits, onClose, onSave }: {
  market: MarketRecord; visits: MarketVisitLog[];
  onClose: () => void; onSave: (updated: MarketRecord) => void;
}) {
  const [tab, setTab] = useState<"info" | "besuche">("info");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<MarketRecord>(market);

  useEffect(() => { setDraft(market); setEditing(false); }, [market.id]);

  const rm = getCurrentRedMonat();
  const marketVisits = [...visits].filter(v => v.marketId === market.id).sort((a, b) => new Date(b.visitedAt).getTime() - new Date(a.visitedAt).getTime());
  const visitedInRedMonat = rm ? marketVisits.some(v => { const d = new Date(v.visitedAt); return d >= rm.start && d <= rm.end; }) : false;
  const visitCount = marketVisits.length;
  const ci = chainInitials(market.name);

  const set = (patch: Partial<MarketRecord>) => setDraft(prev => ({ ...prev, ...patch }));

  return (
    <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: 440, zIndex: 800, display: "flex", flexDirection: "column", background: "#f5f5f7", boxShadow: "-6px 0 32px rgba(0,0,0,0.12), -1px 0 0 rgba(0,0,0,0.06)", animation: "drawerIn 0.22s cubic-bezier(0.4,0,0.2,1) both" }}>
      <style>{`@keyframes drawerIn{from{transform:translateX(100%)}to{transform:translateX(0)}}`}</style>

      {/* Header */}
      <div style={{ background: "#fff", borderBottom: "1px solid rgba(0,0,0,0.06)", padding: "16px 18px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 9, flexShrink: 0, background: ci.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, color: ci.text }}>
            {market.name.slice(0, 2).toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a", letterSpacing: "-0.02em", marginBottom: 2 }}>{market.name}</div>
            <div style={{ fontSize: 10, color: "rgba(0,0,0,0.4)", fontWeight: 500 }}>{market.address} · {market.postalCode} {market.city}</div>
          </div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 8, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.05)", color: "rgba(0,0,0,0.4)", flexShrink: 0, transition: "background 0.12s" }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(0,0,0,0.09)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(0,0,0,0.05)"; }}>
            <X size={13} strokeWidth={2.5} />
          </button>
        </div>

        {/* Badges row */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          {[market.region, market.emEh, market.universeMarket ? "Universum" : null].filter(Boolean).map(b => (
            <span key={b} style={{ fontSize: 9, fontWeight: 600, padding: "2px 8px", borderRadius: 5, background: "rgba(0,0,0,0.05)", color: "rgba(0,0,0,0.5)", letterSpacing: "0.01em" }}>{b}</span>
          ))}
          {market.infoFlag && <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 5, background: "rgba(220,38,38,0.08)", color: R, letterSpacing: "0.01em", display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 5, height: 5, borderRadius: "50%", background: R, display: "inline-block" }} />Info</span>}
        </div>

        {/* Assignment + frequency row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 10, color: "rgba(0,0,0,0.45)", fontWeight: 500 }}>
            Verplant an: <span style={{ color: "#1a1a1a", fontWeight: 600 }}>{market.currentGmName}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <span style={{ fontSize: 7.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "rgba(0,0,0,0.28)", marginBottom: 1 }}>IPP</span>
              <span style={{ fontSize: 18, fontWeight: 900, color: "#16a34a", letterSpacing: "-0.04em", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{market.ipp != null ? market.ipp.toFixed(1) : "—"}</span>
            </div>
            <FrequencyCircle visited={visitCount} frequency={market.visitFrequencyPerYear} visitedThisMonth={visitedInRedMonat} size={34} />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ background: "#fff", borderBottom: "1px solid rgba(0,0,0,0.06)", padding: "0 18px", display: "flex", gap: 0, flexShrink: 0 }}>
        {(["info", "besuche"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: "10px 16px 10px", fontSize: 11, fontWeight: tab === t ? 700 : 500, color: tab === t ? R : "rgba(0,0,0,0.45)", border: "none", background: "none", cursor: "pointer", borderBottom: tab === t ? `2px solid ${R}` : "2px solid transparent", transition: "all 0.12s", fontFamily: "inherit", letterSpacing: "-0.01em" }}>
            {t === "info" ? "Marktinfo" : "Marktbesuche"}
            {t === "besuche" && marketVisits.length > 0 && <span style={{ marginLeft: 5, fontSize: 8, fontWeight: 700, padding: "1px 5px", borderRadius: 10, background: tab === "besuche" ? "rgba(220,38,38,0.1)" : "rgba(0,0,0,0.07)", color: tab === "besuche" ? R : "rgba(0,0,0,0.38)" }}>{new Set(marketVisits.map(v => `${new Date(v.visitedAt).toDateString()}__${v.gmName}`)).size}</span>}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="map-scroll" style={{ flex: 1, overflowY: "auto", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 16 }}>
        {tab === "info" && (
          <>
            {(market.infoNote || editing) && (
              <>
                <InfoSection label="Info">
                  {editing ? (
                    <textarea value={draft.infoNote} onChange={e => set({ infoNote: e.target.value })} placeholder="Notiz zum Markt..."
                      style={{ fontSize: 11, color: "#1a1a1a", border: "1px solid rgba(0,0,0,0.12)", borderRadius: 8, padding: "8px 10px", outline: "none", resize: "vertical", minHeight: 72, background: "#fff", fontFamily: "inherit", lineHeight: 1.5, width: "100%", boxSizing: "border-box" }} />
                  ) : (
                    <p style={{ fontSize: 11, color: "#1a1a1a", margin: 0, lineHeight: 1.6 }}>
                      {market.infoNote}
                    </p>
                  )}
                </InfoSection>
                <div style={{ height: 1, background: "rgba(0,0,0,0.05)" }} />
              </>
            )}

            <InfoSection label="Identität">
              <InfoRow label="Name" value={market.name} edit={editing} editValue={draft.name} onEdit={v => set({ name: v })} />
              <InfoRow label="Name f. DB" value={market.dbName} edit={editing} editValue={draft.dbName} onEdit={v => set({ dbName: v })} />
              <InfoRow label="Flex-Nummer" value={market.flexNumber} edit={editing} editValue={draft.flexNumber} onEdit={v => set({ flexNumber: v })} />
              <InfoRow label="Stammnr. Coke" value={market.cokeMasterNumber} edit={editing} editValue={draft.cokeMasterNumber} onEdit={v => set({ cokeMasterNumber: v })} />
              <InfoRow label="Standardmarkt Nr" value={market.standardMarketNumber} edit={editing} editValue={draft.standardMarketNumber} onEdit={v => set({ standardMarketNumber: v })} />
            </InfoSection>

            <div style={{ height: 1, background: "rgba(0,0,0,0.05)" }} />

            <InfoSection label="Standort">
              <InfoRow label="Adresse" value={market.address} edit={editing} editValue={draft.address} onEdit={v => set({ address: v })} />
              <InfoRow label="Postleitzahl" value={market.postalCode} edit={editing} editValue={draft.postalCode} onEdit={v => set({ postalCode: v })} />
              <InfoRow label="Ort" value={market.city} edit={editing} editValue={draft.city} onEdit={v => set({ city: v })} />
              <InfoRow label="Region" value={market.region} edit={editing} editValue={draft.region} onEdit={v => set({ region: v })} />
            </InfoSection>

            <div style={{ height: 1, background: "rgba(0,0,0,0.05)" }} />

            <InfoSection label="Zuordnung & Klassifikation">
              <InfoRow label="EM/EH" value={market.emEh} edit={editing} editValue={draft.emEh} onEdit={v => set({ emEh: v })} />
              <InfoRow label="Mitarbeiter" value={market.employee} edit={editing} editValue={draft.employee} onEdit={v => set({ employee: v })} />
              <InfoRow label="Aktuell verplant an" value={market.currentGmName} edit={editing} editValue={draft.currentGmName} onEdit={v => set({ currentGmName: v })} />
              <InfoRow label="Universums-markt" value={market.universeMarket ? "Ja" : "Nein"} />
              <InfoRow label="Besuchsfrequenz / Jahr" value={String(market.visitFrequencyPerYear)} edit={editing} editValue={String(draft.visitFrequencyPerYear)} onEdit={v => set({ visitFrequencyPerYear: parseInt(v) || market.visitFrequencyPerYear })} />
            </InfoSection>

            {editing && (
              <>
                <div style={{ height: 1, background: "rgba(0,0,0,0.05)" }} />
                <InfoSection label="Info">
                  <textarea value={draft.infoNote} onChange={e => set({ infoNote: e.target.value })} placeholder="Notiz zum Markt..."
                    style={{ fontSize: 11, color: "#1a1a1a", border: "1px solid rgba(0,0,0,0.12)", borderRadius: 8, padding: "8px 10px", outline: "none", resize: "vertical", minHeight: 72, background: "#fff", fontFamily: "inherit", lineHeight: 1.5, width: "100%", boxSizing: "border-box" }} />
                </InfoSection>
              </>
            )}
          </>
        )}

        {tab === "besuche" && (() => {
          // Group by date + GM into visit sessions
          const groups = new Map<string, MarketVisitLog[]>();
          marketVisits.forEach(v => {
            const key = `${new Date(v.visitedAt).toDateString()}__${v.gmName}`;
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key)!.push(v);
          });
          const sessions = [...groups.values()].sort((a, b) =>
            new Date(b[0].visitedAt).getTime() - new Date(a[0].visitedAt).getTime()
          );
          return (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {sessions.length === 0 ? (
                <div style={{ textAlign: "center", padding: "32px 0", color: "rgba(0,0,0,0.28)", fontSize: 11 }}>Noch keine Besuche aufgezeichnet.</div>
              ) : sessions.map((logs, i) => (
                <VisitCard key={i} logs={logs} />
              ))}
            </div>
          );
        })()}
      </div>

      {/* Edit action footer */}
      {tab === "info" && (
        <div style={{ background: "#fff", borderTop: "1px solid rgba(0,0,0,0.06)", padding: "12px 18px", flexShrink: 0, display: "flex", justifyContent: "flex-end", gap: 8 }}>
          {editing ? (
            <>
              <button onClick={() => { setDraft(market); setEditing(false); }}
                style={{ padding: "7px 14px", fontSize: 11, fontWeight: 600, borderRadius: 8, border: "1px solid rgba(0,0,0,0.09)", cursor: "pointer", color: "rgba(0,0,0,0.45)", background: "linear-gradient(to bottom,#fff,#f5f5f5)", boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.9),0 0 0 1px rgba(0,0,0,0.09),0 1px 4px rgba(0,0,0,0.05)", display: "flex", alignItems: "center", gap: 5, fontFamily: "inherit", transition: "opacity 0.15s" }}
                onMouseEnter={e => { e.currentTarget.style.opacity = "0.75"; }} onMouseLeave={e => { e.currentTarget.style.opacity = "1"; }}>
                <RotateCcw size={11} strokeWidth={2} /> Abbrechen
              </button>
              <button onClick={() => { onSave(draft); setEditing(false); }}
                style={{ padding: "7px 16px", fontSize: 11, fontWeight: 700, borderRadius: 8, border: "none", cursor: "pointer", color: "#fff", background: `linear-gradient(to bottom,${R},${RD})`, boxShadow: `inset 0 1px 0.6px rgba(255,255,255,0.33),0 0 0 1px #a91b1b,0 1px 6px rgba(180,20,20,0.14)`, display: "flex", alignItems: "center", gap: 5, fontFamily: "inherit", transition: "opacity 0.15s" }}
                onMouseEnter={e => { e.currentTarget.style.opacity = "0.9"; }} onMouseLeave={e => { e.currentTarget.style.opacity = "1"; }}>
                <Save size={11} strokeWidth={2} /> Speichern
              </button>
            </>
          ) : (
            <button onClick={() => setEditing(true)}
              style={{ padding: "7px 14px", fontSize: 11, fontWeight: 600, borderRadius: 8, border: "none", cursor: "pointer", color: "rgba(0,0,0,0.45)", background: "linear-gradient(to bottom,#fff,#f5f5f5)", boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.9),0 0 0 1px rgba(0,0,0,0.09),0 1px 4px rgba(0,0,0,0.05)", display: "flex", alignItems: "center", gap: 5, fontFamily: "inherit", transition: "opacity 0.15s" }}
              onMouseEnter={e => { e.currentTarget.style.opacity = "0.75"; }} onMouseLeave={e => { e.currentTarget.style.opacity = "1"; }}>
              <Edit2 size={11} strokeWidth={2} /> Bearbeiten
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────

export default function MaerktePage() {
  const [markets, setMarkets] = useState<MarketRecord[]>([]);
  const [visits,  setVisits]  = useState<MarketVisitLog[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<MarketFilters>({
    region: null, city: null, postalCode: null, emEh: null, employee: null,
    universeMarket: null, infoFlag: null, currentGmName: null,
    redMonatVisited: null, frequencyBucket: null,
  });
  const [openFilter, setOpenFilter] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  // ── localStorage ───────────────────────────────────────────
  useEffect(() => {
    setMounted(true);
    try {
      const stored = localStorage.getItem(LS_MARKETS);
      const storedV = localStorage.getItem(LS_VISITS);
      // Auto-seed on first visit
      if (!stored) {
        const seedVisits = buildSeedVisits();
        localStorage.setItem(LS_MARKETS, JSON.stringify(SEED_MARKETS));
        localStorage.setItem(LS_VISITS, JSON.stringify(seedVisits));
        setMarkets(SEED_MARKETS);
        setVisits(seedVisits);
      } else {
        setMarkets(JSON.parse(stored));
        setVisits(storedV ? JSON.parse(storedV) : []);
      }
    } catch {
      setMarkets(SEED_MARKETS);
      setVisits(buildSeedVisits());
    }
    // Listen for import trigger from header button
    const handler = () => setShowImport(true);
    window.addEventListener("maerkte:openImport", handler);
    return () => window.removeEventListener("maerkte:openImport", handler);
  }, []);

  const saveMarkets = useCallback((m: MarketRecord[]) => {
    setMarkets(m);
    try { localStorage.setItem(LS_MARKETS, JSON.stringify(m)); } catch { /* noop */ }
  }, []);

  const handleImport = useCallback(() => {
    const seedVisits = buildSeedVisits();
    saveMarkets(SEED_MARKETS);
    setVisits(seedVisits);
    try { localStorage.setItem(LS_VISITS, JSON.stringify(seedVisits)); } catch { /* noop */ }
    setShowImport(false);
    window.dispatchEvent(new CustomEvent("maerkte:imported", { detail: { count: SEED_MARKETS.length } }));
  }, [saveMarkets]);

  const handleSave = useCallback((updated: MarketRecord) => {
    saveMarkets(markets.map(m => m.id === updated.id ? updated : m));
  }, [markets, saveMarkets]);

  // ── Derived filter options ─────────────────────────────────
  const opts = useMemo(() => ({
    region:   [...new Set(markets.map(m => m.region))].sort(),
    city:     [...new Set(markets.map(m => m.city))].sort(),
    postalCode:[...new Set(markets.map(m => m.postalCode))].sort(),
    emEh:     [...new Set(markets.map(m => m.emEh))].sort(),
    employee: [...new Set(markets.map(m => m.employee))].sort(),
    gmName:   [...new Set(markets.map(m => m.currentGmName))].sort(),
  }), [markets]);

  // ── RED Monat state ────────────────────────────────────────
  const rm = useMemo(() => getCurrentRedMonat(), []);
  const visitedInRedMonatSet = useMemo(() => {
    if (!rm) return new Set<string>();
    return new Set(visits.filter(v => {
      const d = new Date(v.visitedAt);
      return d >= rm.start && d <= rm.end;
    }).map(v => v.marketId));
  }, [visits, rm]);

  const visitCountByMarket = useMemo(() => {
    const counts: Record<string, number> = {};
    visits.forEach(v => { counts[v.marketId] = (counts[v.marketId] ?? 0) + 1; });
    return counts;
  }, [visits]);

  // ── Filtering ──────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return markets.filter(m => {
      if (q) {
        const hay = `${m.name} ${m.dbName} ${m.address} ${m.postalCode} ${m.city} ${m.flexNumber} ${m.cokeMasterNumber} ${m.standardMarketNumber} ${m.currentGmName}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (filters.region && m.region !== filters.region) return false;
      if (filters.city && m.city !== filters.city) return false;
      if (filters.postalCode && m.postalCode !== filters.postalCode) return false;
      if (filters.emEh && m.emEh !== filters.emEh) return false;
      if (filters.employee && m.employee !== filters.employee) return false;
      if (filters.currentGmName && m.currentGmName !== filters.currentGmName) return false;
      if (filters.universeMarket) {
        if (filters.universeMarket === "Ja" && !m.universeMarket) return false;
        if (filters.universeMarket === "Nein" && m.universeMarket) return false;
      }
      if (filters.infoFlag) {
        if (filters.infoFlag === "Ja" && !m.infoFlag) return false;
        if (filters.infoFlag === "Nein" && m.infoFlag) return false;
      }
      if (filters.redMonatVisited) {
        const vis = visitedInRedMonatSet.has(m.id);
        if (filters.redMonatVisited === "Alle" && !m.universeMarket) return false;
        if (filters.redMonatVisited === "Besucht" && !vis) return false;
        if (filters.redMonatVisited === "Nicht besucht" && vis) return false;
      }
      if (filters.frequencyBucket) {
        const freq = m.visitFrequencyPerYear;
        if (filters.frequencyBucket === "4" && freq !== 4) return false;
        if (filters.frequencyBucket === "6" && freq !== 6) return false;
        if (filters.frequencyBucket === "12" && freq !== 12) return false;
        if (filters.frequencyBucket === "Sonstige" && [4, 6, 12].includes(freq)) return false;
      }
      return true;
    });
  }, [markets, search, filters, visitedInRedMonatSet]);

  const activeFilterCount = Object.values(filters).filter(Boolean).length;
  const selectedMarket = useMemo(() => markets.find(m => m.id === selectedId) ?? null, [markets, selectedId]);

  // ── Filter chip helper ─────────────────────────────────────
  function FilterBtn({ label, filterKey, opts: options, inactiveLabel, nullLabel }: { label: string; filterKey: keyof MarketFilters; opts: string[]; inactiveLabel?: string; nullLabel?: string }) {
    const active = !!filters[filterKey];
    const val = filters[filterKey] as string | null;
    const btnRef = useRef<HTMLButtonElement>(null);
    return (
      <>
        <button ref={btnRef} onClick={() => setOpenFilter(openFilter === filterKey ? null : filterKey)}
          style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 7, fontSize: 10, fontWeight: 500, border: active ? "1px solid rgba(220,38,38,0.25)" : "1px solid rgba(0,0,0,0.08)", background: active ? "rgba(220,38,38,0.04)" : "#fff", color: active ? R : "rgba(0,0,0,0.55)", cursor: "pointer", fontFamily: "inherit", transition: "all 0.12s", whiteSpace: "nowrap" }}>
          {label}
          <ChevronDown size={10} strokeWidth={2} style={{ transform: openFilter === filterKey ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s" }} />
        </button>
        {openFilter === filterKey && (
          <FilterDropdown options={options} value={val} anchorRef={btnRef} nullLabel={nullLabel}
            onChange={v => setFilters(prev => ({ ...prev, [filterKey]: v }))}
            onClose={() => setOpenFilter(null)} />
        )}
      </>
    );
  }

  if (!mounted) return null;

  const hasFilters = !!search.trim() || activeFilterCount > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, position: "relative" }}>
      <style>{`
        @keyframes mktFadeIn { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:translateY(0) } }
        .mkt-main { animation: mktFadeIn 0.25s ease both; }
      `}</style>

      {/* Page action row — nothing shown */}
      <div />

      {/* Main list card — grey outer / white inner, same as Prämien */}
      <div className="mkt-main" style={{ background: "rgba(0,0,0,0.025)", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 14, overflow: "hidden" }}>

        {/* Grey header area */}
        <div style={{ padding: "13px 18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: "rgba(0,0,0,0.3)" }}>Märkte</span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: "rgba(0,0,0,0.35)", fontVariantNumeric: "tabular-nums" }}>
              {filtered.length !== markets.length ? `${filtered.length} / ` : ""}{markets.length} Märkte
            </span>
            {hasFilters && (
              <button
                onClick={() => { setSearch(""); setFilters({ region: null, city: null, postalCode: null, emEh: null, employee: null, universeMarket: null, infoFlag: null, currentGmName: null, redMonatVisited: null, frequencyBucket: null }); }}
                style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 6, border: "1px solid rgba(0,0,0,0.1)", background: "rgba(0,0,0,0.035)", cursor: "pointer", color: "rgba(0,0,0,0.4)", fontSize: 9, fontWeight: 600, fontFamily: "inherit", transition: "all 0.12s" }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(220,38,38,0.06)"; e.currentTarget.style.color = R; e.currentTarget.style.borderColor = "rgba(220,38,38,0.2)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(0,0,0,0.035)"; e.currentTarget.style.color = "rgba(0,0,0,0.4)"; e.currentTarget.style.borderColor = "rgba(0,0,0,0.1)"; }}
              >
                <X size={9} strokeWidth={2.5} />
                Filter
              </button>
            )}
          </div>
        </div>

        {/* White inner card */}
        <div style={{ margin: "0 10px 10px", background: "#fff", borderRadius: 12, border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 1px 6px rgba(0,0,0,0.05)", overflow: "hidden" }}>

        {markets.length === 0 ? (
          <div style={{ padding: "60px 40px", display: "flex", flexDirection: "column", alignItems: "center", gap: 14, textAlign: "center" }}>
            <div style={{ width: 52, height: 52, borderRadius: 14, background: "rgba(220,38,38,0.07)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <MapPin size={22} strokeWidth={1.5} color={R} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a", letterSpacing: "-0.02em", marginBottom: 6 }}>Noch keine Märkte importiert</div>
              <div style={{ fontSize: 11, color: "rgba(0,0,0,0.4)", maxWidth: 320, lineHeight: 1.6 }}>
                Klicke auf „Importieren" um Märkte aus einer Excel-Datei zu laden oder Testdaten zu verwenden.
              </div>
            </div>
            <button onClick={() => setShowImport(true)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 18px", fontSize: 11, fontWeight: 700, color: "#fff", background: `linear-gradient(to bottom,${R},${RD})`, border: "none", borderRadius: 8, cursor: "pointer", boxShadow: `inset 0 1px 0.6px rgba(255,255,255,0.33),0 0 0 1px #a91b1b,0 1px 6px rgba(180,20,20,0.14)` }}>
              <Upload size={11} strokeWidth={2} /> Importieren
            </button>
          </div>
        ) : (
          <>
            {/* Search left, filters right */}
            <div style={{ padding: "10px 14px", borderBottom: "1px solid rgba(0,0,0,0.05)", display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {/* Search — left anchored */}
                <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 7, background: "rgba(0,0,0,0.03)", border: "1px solid transparent", flex: "0 0 200px", transition: "border 0.15s" }}
                  onFocusCapture={e => { (e.currentTarget as HTMLElement).style.border = "1px solid rgba(0,0,0,0.14)"; (e.currentTarget as HTMLElement).style.background = "#fff"; }}
                  onBlurCapture={e => { (e.currentTarget as HTMLElement).style.border = "1px solid transparent"; (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.03)"; }}>
                  <Search size={11} strokeWidth={2} color="rgba(0,0,0,0.3)" />
                  <input type="text" placeholder="Markt suchen…" value={search} onChange={e => setSearch(e.target.value)}
                    style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 11, color: "#1a1a1a", fontFamily: "inherit" }} />
                  {search && <button onClick={() => setSearch("")} style={{ border: "none", background: "none", cursor: "pointer", padding: 0, color: "rgba(0,0,0,0.3)", display: "flex" }}><X size={10} strokeWidth={2} /></button>}
                </div>

                {/* Filters — pushed to right */}
                <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  <FilterBtn label="Region" filterKey="region" opts={opts.region} />
                  <FilterBtn label="Ort" filterKey="city" opts={opts.city} />
                  <FilterBtn label="PLZ" filterKey="postalCode" opts={opts.postalCode} />
                  <FilterBtn label="EM/EH" filterKey="emEh" opts={["EM", "EH"]} />
                  <FilterBtn label="Mitarbeiter" filterKey="employee" opts={opts.employee} />
                  <FilterBtn label="GM" filterKey="currentGmName" opts={opts.gmName} />
                  <FilterBtn label="Universum" filterKey="universeMarket" opts={["Ja", "Nein"]} />
                  <FilterBtn label="Info" filterKey="infoFlag" opts={["Ja", "Nein"]} />
                  <FilterBtn label="RED Monat" inactiveLabel="Nicht aktiv" filterKey="redMonatVisited" opts={["Alle", "Besucht", "Nicht besucht"]} nullLabel="Nicht aktiv" />
                  <FilterBtn label="Frequenz" filterKey="frequencyBucket" opts={["4", "6", "12", "Sonstige"]} />

                </div>
              </div>

              {/* Active filter strip */}
              {activeFilterCount > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 9, color: "rgba(0,0,0,0.35)", fontWeight: 500, flexShrink: 0 }}>{filtered.length} / {markets.length} Märkte</span>
                  {(Object.entries(filters) as [keyof MarketFilters, string | null][]).filter(([, v]) => v).map(([k, v]) => (
                    <button key={k} onClick={() => setFilters(prev => ({ ...prev, [k]: null }))}
                      style={{ display: "flex", alignItems: "center", gap: 4, padding: "2px 7px", borderRadius: 5, fontSize: 9, fontWeight: 600, background: "rgba(220,38,38,0.07)", color: R, border: "none", cursor: "pointer", fontFamily: "inherit" }}>
                      {v}<X size={7} strokeWidth={2.5} />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Column header */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 50px 160px 120px 70px 130px 40px 40px", gap: "0 12px", padding: "7px 18px", background: "rgba(0,0,0,0.018)", borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
              {["Markt", "Info", "Adresse", "Region / Ort", "EM/EH", "Verplant an", "IPP", "Freq."].map((h, i) => (
                <span key={i} style={{ fontSize: 8.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "rgba(0,0,0,0.28)" }}>{h}</span>
              ))}
            </div>

            {/* Rows */}
            <div className="map-scroll" style={{ maxHeight: "calc(100vh - 120px)", overflowY: "auto" }}>
              {filtered.length === 0 ? (
                <div style={{ padding: "32px 0", textAlign: "center" }}>
                  <span style={{ fontSize: 11, color: "rgba(0,0,0,0.28)" }}>Keine Märkte gefunden.</span>
                </div>
              ) : filtered.map(m => {
                const active = m.id === selectedId;
                const ci = chainInitials(m.name);
                const vis = visitedInRedMonatSet.has(m.id);
                const cnt = visitCountByMarket[m.id] ?? 0;
                return (
                  <div key={m.id} onClick={() => setSelectedId(active ? null : m.id)}
                    style={{ display: "grid", gridTemplateColumns: "1fr 50px 160px 120px 70px 130px 40px 40px", gap: "0 12px", padding: "10px 18px", borderBottom: "1px solid rgba(0,0,0,0.04)", cursor: "pointer", background: active ? "rgba(220,38,38,0.04)" : "transparent", borderLeft: active ? `3px solid ${R}` : "3px solid transparent", transition: "all 0.1s ease", alignItems: "center" }}
                    onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.018)"; }}
                    onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "transparent"; }}>

                    {/* Markt */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                      <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 5, background: ci.bg, color: ci.text, letterSpacing: "0.02em", flexShrink: 0, textTransform: "uppercase" }}>
                        {m.name.split(" ")[0].slice(0, 4)}
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: active ? R : "#1a1a1a", letterSpacing: "-0.01em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.name}</div>
                        <div style={{ fontSize: 9, color: "rgba(0,0,0,0.35)", marginTop: 1 }}>{m.dbName}</div>
                      </div>
                    </div>

                    {/* Info dot — own column */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {m.infoFlag && <span style={{ width: 6, height: 6, borderRadius: "50%", background: R, flexShrink: 0 }} title="Info vorhanden" />}
                    </div>

                    {/* Adresse */}
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 11, color: "#374151", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.address}</div>
                    </div>

                    {/* Region / Ort */}
                    <div>
                      <div style={{ fontSize: 11, color: "#374151" }}>{m.region}</div>
                      <div style={{ fontSize: 9, color: "rgba(0,0,0,0.35)", marginTop: 1 }}>{m.postalCode} {m.city}</div>
                    </div>

                    {/* EM/EH */}
                    <span style={{ fontSize: 10, fontWeight: 600, color: "rgba(0,0,0,0.5)" }}>{m.emEh}</span>

                    {/* Verplant an */}
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 10, color: "#374151", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontWeight: 500 }}>{m.currentGmName}</div>
                    </div>

                    {/* IPP */}
                    <span style={{ fontSize: 12, fontWeight: 800, color: "#16a34a", letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>{m.ipp != null ? m.ipp.toFixed(1) : "—"}</span>

                    {/* Frequenz circle */}
                    <FrequencyCircle visited={cnt} frequency={m.visitFrequencyPerYear} visitedThisMonth={vis} size={34} />
                  </div>
                );
              })}
            </div>
          </>
        )}
        </div>{/* end white inner card */}
      </div>{/* end grey outer card */}

      {/* Detail drawer */}
      {selectedMarket && (
        <MarketDetailDrawer
          market={selectedMarket}
          visits={visits}
          onClose={() => setSelectedId(null)}
          onSave={handleSave}
        />
      )}

      {/* Import modal */}
      {showImport && <ImportModal onImport={handleImport} onClose={() => setShowImport(false)} />}
    </div>
  );
}
