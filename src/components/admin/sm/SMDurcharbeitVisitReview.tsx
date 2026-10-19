"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, CheckCheck, LoaderCircle, Search, X } from "lucide-react";
import { AdminDropdown } from "@/components/admin/AdminFilterControls";
import type { SmManagementApi, SmManagementList } from "@/types/smManagement";
import styles from "./SMDurcharbeitCampaignWorkspace.module.css";

const dateLabel = (date: string) => new Intl.DateTimeFormat("de-AT", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Vienna" }).format(new Date(date.length === 10 ? `${date}T12:00:00Z` : date));
const timeLabel = (date: string) => new Intl.DateTimeFormat("de-AT", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Vienna" }).format(new Date(date));

export function SMDurcharbeitVisitReview({ api, month, reloadKey, onOpen }: { api: SmManagementApi; month: string; reloadKey: number; onOpen: (id: string) => void }) {
  const [search, setSearch] = useState(""), [debouncedSearch, setDebouncedSearch] = useState("");
  const [sm, setSm] = useState(""), [market, setMarket] = useState("");
  const [data, setData] = useState<{ key: string; result: SmManagementList } | null>(null);
  const [error, setError] = useState<string | null>(null), [loadingMore, setLoadingMore] = useState(false), [retry, setRetry] = useState(0);
  const generation = useRef(0);
  useEffect(() => { const timer = setTimeout(() => setDebouncedSearch(search.trim()), 250); return () => clearTimeout(timer); }, [search]);
  const query = useMemo(() => ({ from: month, to: month, search: debouncedSearch || undefined, smUserId: sm || undefined, marketId: market || undefined, limit: 40 }), [month, debouncedSearch, sm, market]);
  const key = JSON.stringify([query, reloadKey, retry]), result = data?.key === key ? data.result : null;
  useEffect(() => {
    const request = ++generation.current;
    setError(null); setLoadingMore(false);
    void api.list(query).then(result => { if (request === generation.current) setData({ key, result }); })
      .catch(error => { if (request === generation.current) setError(error instanceof Error ? error.message : "Besuche konnten nicht geladen werden."); });
    return () => { generation.current = request + 1; };
  }, [api, query, key]);
  const more = async () => {
    if (!result?.nextCursor || loadingMore) return;
    const request = generation.current; setLoadingMore(true); setError(null);
    try {
      const page = await api.list({ ...query, cursorDate: result.nextCursor.date, cursorId: result.nextCursor.id });
      if (request === generation.current) setData({ key, result: { ...page, visits: [...result.visits, ...page.visits] } });
    } catch (error) { if (request === generation.current) setError(error instanceof Error ? error.message : "Weitere Besuche konnten nicht geladen werden."); }
    finally { if (request === generation.current) setLoadingMore(false); }
  };
  const facets = data?.result.facets ?? [];
  const people = [...new Map(facets.map(item => [item.smUserId, { value: item.smUserId, label: item.smName }])).values()].sort((a,b) => a.label.localeCompare(b.label, "de"));
  const markets = [...new Map(facets.map(item => [item.marketId, { value: item.marketId, label: item.marketName }])).values()].sort((a,b) => a.label.localeCompare(b.label, "de"));
  const filtered = Boolean(search || sm || market);
  return <div>
    <div className={styles.reviewFilters}>
      <label className={styles.reviewSearch}><Search size={13} aria-hidden="true" /><input aria-label="Abgeschlossene Besuche durchsuchen" maxLength={200} value={search} onChange={event => setSearch(event.target.value)} placeholder="Markt, SM, Datum oder Antwort suchen…" />{search ? <button type="button" aria-label="Suche leeren" onClick={() => setSearch("")}><X size={12} /></button> : null}</label>
      <div className={styles.reviewPerson}><AdminDropdown compact value={sm} options={[{ value: "", label: "Alle SMs" }, ...people]} onChange={setSm} ariaLabel="Besuche nach SM filtern" placeholder="Alle SMs" searchable /></div>
      <div className={styles.reviewMarket}><AdminDropdown compact value={market} options={[{ value: "", label: "Alle Märkte" }, ...markets]} onChange={setMarket} ariaLabel="Besuche nach Markt filtern" placeholder="Alle Märkte" searchable /></div>
      <button type="button" className={styles.reviewReset} disabled={!filtered} onClick={() => { setSearch(""); setDebouncedSearch(""); setSm(""); setMarket(""); }}>Zurücksetzen</button>
    </div>
    {data?.result.facetsTruncated ? <p className={styles.reviewIntro}>Weitere SMs und Märkte findest du über die Suche.</p> : null}
    <div className={styles.reviewIntro}><span>Jeder abgeschlossene Besuch · neueste zuerst</span><span aria-live="polite">{result ? `${result.visits.length}${result.nextCursor ? "+" : ""} ${filtered ? "Treffer" : result.visits.length === 1 && !result.nextCursor ? "Besuch" : "Besuche"}` : error ? "" : "Wird geladen…"}</span></div>
    {error ? <div className={styles.reviewError} role="alert">{error} <button type="button" onClick={() => result?.nextCursor ? void more() : setRetry(value => value + 1)}>Erneut versuchen</button></div> : null}
    {!result && !error ? <div className={styles.loading} role="status" aria-label="Abgeschlossene Besuche werden geladen">{[0,1,2].map(id => <div key={id} className={`${styles.loadingRow} motion-safe:animate-pulse`} />)}</div> : result?.visits.length ? <>
      <div className={styles.scrollRegion} role="region" aria-label="Abgeschlossene Durcharbeit-Besuche" tabIndex={0}><table className={`${styles.table} ${styles.reviewTable}`}>
        <thead><tr><th scope="col">Markt</th><th scope="col">SM</th><th scope="col">Besuch</th><th scope="col">Fragebogen</th><th scope="col"><span className="sr-only">Antworten prüfen</span></th></tr></thead>
        <tbody>{result.visits.map(visit => <tr key={visit.id}>
          <td><button type="button" className={styles.reviewOpen} onClick={() => onOpen(visit.id)}><span className={styles.marketName}>{visit.marketName}</span><ArrowUpRight size={12} aria-hidden="true" /></button><p className={styles.marketAddress}>{visit.address}</p></td>
          <td>{visit.smName}</td><td className={styles.reviewDate}>{dateLabel(visit.workDate)}<p className={styles.marketAddress}>{visit.startedAt && visit.completedAt ? `${timeLabel(visit.startedAt)} – ${timeLabel(visit.completedAt)}` : "Abgeschlossen"}</p></td>
          <td><span className={styles.reviewQuestionnaire}>{visit.questionnaireName}</span><p className={styles.marketAddress}>Version {visit.questionnaireVersion} · {visit.answeredCount} Antworten</p></td>
          <td><button type="button" className={styles.secondary} aria-label={`Antworten von ${visit.marketName} am ${dateLabel(visit.workDate)} prüfen`} onClick={() => onOpen(visit.id)}>Antworten prüfen</button></td>
        </tr>)}</tbody>
      </table></div>
      {result.nextCursor ? <div className={styles.reviewPagination}><button type="button" className={styles.secondary} disabled={loadingMore} onClick={() => void more()}>{loadingMore ? <LoaderCircle size={12} className="animate-spin" /> : null}Weitere Besuche laden</button></div> : null}
    </> : result ? <div className={styles.reviewEmpty}><CheckCheck size={23} strokeWidth={1.4} aria-hidden="true" /><strong>{filtered ? "Keine passenden Besuche" : "Noch keine abgeschlossenen Besuche"}</strong><span>{filtered ? "Passe die Suche oder die Filter an." : "Sobald ein SM einen Besuch abschließt, kannst du hier alle Antworten prüfen."}</span></div> : null}
  </div>;
}
