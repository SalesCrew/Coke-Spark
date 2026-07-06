import type { MarketRecord } from "@/types/markets";

export function getMarketChainLabel(record: Pick<MarketRecord, "name" | "dbName">): string {
  const dbName = record.dbName?.trim();
  if (dbName) return dbName.toUpperCase();

  const source = `${record.name} ${record.dbName ?? ""}`.toUpperCase();
  if (source.includes("BILLA+")) return "BILLA+";
  if (source.includes("BILLA")) return "BILLA";
  if (source.includes("SPAR")) return "SPAR";
  if (source.includes("ADEG")) return "ADEG";
  if (source.includes("PENNY")) return "PENNY";
  if (source.includes("HOFER")) return "HOFER";
  if (source.includes("MERKUR")) return "MERKUR";
  return record.name?.trim().split(" ")[0]?.toUpperCase() || "MARKT";
}

