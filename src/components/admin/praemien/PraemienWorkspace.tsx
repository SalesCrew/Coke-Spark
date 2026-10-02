"use client";
import { conditionText, metricUnit } from "@/lib/praemien-goals";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Award,
  Check,
  ChevronRight,
  Copy,
  Gift,
  LockKeyhole,
  Plus,
  RefreshCw,
  Settings2,
  Trophy,
  X,
} from "lucide-react";
import { requestPraemienWorkspace as api } from "@/lib/api/backend";
import { useAdminAccess } from "@/context/AdminAccessContext";
import type {
  Workspace,
  WaveInfo,
  WaveModel,
  GmResult,
  MetricEntry,
} from "@/types/praemien-workspace";
import { BoniSelect } from "./BoniSelect";
import { ModelEditor } from "./ModelEditor";
import { useDialog } from "./useDialog";
import { exportPraemien } from "./praemienExport";
import styles from "./praemien.module.css";

export const euro = (n: number) =>
  n.toLocaleString("de-AT", { style: "currency", currency: "EUR" });
export const decimal = (n: number | null) =>
  n === null
    ? "offen"
    : n.toLocaleString("de-AT", { maximumFractionDigits: 2 });
export const parseDecimal = (s: string): number | null =>
  s.trim() === "" ? null : Number(s.trim().replace(",", "."));
type Tab = "Übersicht" | "Regeln & Quellen" | "Mitarbeiterwerte" | "Verlauf";
type WaveListItem = WaveInfo & { revision: number | null };

export function PraemienWorkspace() {
  const access = useAdminAccess();
  const canCreate = access.canWrite("praemien"),
    canEdit = access.canUpdate("praemien");
  const [waves, setWaves] = useState<WaveListItem[]>([]),
    [selected, setSelected] = useState("");
  const [workspace, setWorkspace] = useState<Workspace | null>(null),
    [tab, setTab] = useState<Tab>("Übersicht");
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false),
    [editing, setEditing] = useState<WaveModel | null>(null),
    [gm, setGm] = useState<GmResult | null>(null);
  const [editingKey, setEditingKey] = useState<string>();
  const [confirming, setConfirming] = useState<"activate" | "archive" | null>(
    null,
  );
  const [search, setSearch] = useState(""),
    [filter, setFilter] = useState("all"),
    [scope, setScope] = useState("quarter");
  const [totals, setTotals] = useState<
    {
      gmId: string;
      name: string;
      active: boolean;
      earned: number;
      quarters: number;
    }[]
  >([]);
  const loadWaves = useCallback(async (preferred?: string) => {
    const data = await api<{ waves: WaveListItem[] }>("/waves");
    setWaves(data.waves);
    setSelected(
      (old) =>
        preferred ??
        (data.waves.some((w) => w.id === old)
          ? old
          : (data.waves[0]?.id ?? "")),
    );
  }, []);
  useEffect(() => {
    let cancelled = false;
    loadWaves()
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loadWaves]);
  useEffect(() => {
    if (!selected) {
      setWorkspace(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError("");
    api<Workspace>(`/waves/${selected}`)
      .then((w) => {
        if (!cancelled) setWorkspace(w);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selected]);
  useEffect(() => {
    if (scope === "total")
      api<{ results: typeof totals }>("/leaderboard")
        .then((r) => setTotals(r.results))
        .catch((e) => setError(e.message));
  }, [scope]);
  async function reload() {
    setError("");
    setLoading(true);
    try {
      await loadWaves();
      if (selected) setWorkspace(await api<Workspace>(`/waves/${selected}`));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  async function save(command: object) {
    if (!workspace) return;
    setBusy(true);
    setError("");
    try {
      const w = await api<Workspace>(
        `/waves/${workspace.wave.id}`,
        { ...command, revision: workspace.revision },
        "PUT",
      );
      setWorkspace(w);
      await loadWaves(w.wave.id);
      return w;
    } catch (e) {
      setError((e as Error).message);
      throw e;
    } finally {
      setBusy(false);
    }
  }
  const frozen = workspace?.wave.status === "archived";
  useEffect(() => {
    const exportCurrent = () => {
      if (!workspace?.model) {
        setError("Zuerst eine eingerichtete Welle wählen.");
        return;
      }
      void exportPraemien(workspace).catch((e) =>
        setError((e as Error).message),
      );
    };
    window.addEventListener("admin:praemien:export", exportCurrent);
    return () =>
      window.removeEventListener("admin:praemien:export", exportCurrent);
  }, [workspace]);
  const rows =
    workspace?.results.filter(
      (r) =>
        r.name
          .toLocaleLowerCase("de")
          .includes(search.toLocaleLowerCase("de")) &&
        (filter === "all" ||
          (filter === "pending" && r.pending) ||
          (filter === "manual" &&
            r.pillars.some((p) =>
              p.metrics.some((m) => m.origin === "manual"),
            ))),
    ) ?? [];
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.heading}>
          <span className={styles.icon}>
            <Gift size={22} />
          </span>
          <div>
            <span className={styles.eyebrow}>GM · QUARTALSPRÄMIEN</span>
            <h1>Prämienwelle</h1>
            <p>Klare Ziele. Nachvollziehbare Werte. Echte Mitarbeiter.</p>
          </div>
        </div>
        <div className={styles.actions}>
          <BoniSelect
            aria-label="Prämienwelle wählen"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            disabled={busy}
          >
            {!waves.length && <option value="">Keine Welle</option>}
            {waves.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name} · Q{w.quarter} {w.year}
              </option>
            ))}
          </BoniSelect>
          <button aria-label="Neu laden" onClick={reload} disabled={busy}>
            <RefreshCw size={16} />
          </button>
          <button
            className={styles.primary}
            onClick={() => setCreating(true)}
            disabled={busy || !canCreate}
          >
            <Plus size={16} /> Neue Welle
          </button>
        </div>
      </header>
      {error && (
        <div role="alert" className={styles.error}>
          {error}
          <button onClick={reload}>Neu laden</button>
        </div>
      )}
      {loading && (
        <div role="status" className={styles.empty}>
          Prämien werden geladen …
        </div>
      )}
      {!loading && workspace && (
        <>
          <section className={styles.wavebar}>
            <div>
              <strong>{workspace.wave.name}</strong>
              <p>
                {new Date(workspace.wave.startDate).toLocaleDateString("de-AT")}{" "}
                – {new Date(workspace.wave.endDate).toLocaleDateString("de-AT")}{" "}
                · Version {workspace.revision} ·{" "}
                {workspace.closedAt
                  ? `Eingefroren am ${new Date(workspace.closedAt).toLocaleString("de-AT")}`
                  : `Berechnet ${new Date(workspace.calculatedAt).toLocaleTimeString("de-AT")}`}
              </p>
            </div>
            <div className={styles.actions}>
              <span className={styles.badge}>
                {frozen ? <LockKeyhole size={13} /> : <Check size={13} />}
                {frozen
                  ? "Abgeschlossen"
                  : workspace.wave.status === "active"
                    ? "Laufend"
                    : "Entwurf"}
              </span>
              <button disabled={!canCreate} onClick={() => setCreating(true)}>
                <Copy size={14} /> Regeln kopieren
              </button>
              {workspace.model && !frozen && canEdit && (
                <button
                  disabled={busy}
                  onClick={() => {
                    setConfirming(
                      workspace.wave.status === "active"
                        ? "archive"
                        : "activate",
                    );
                  }}
                >
                  {workspace.wave.status === "active"
                    ? "Quartal abschließen"
                    : "Welle aktivieren"}
                </button>
              )}
            </div>
          </section>
          {!workspace.model ? (
            <div className={styles.empty}>
              <Settings2 size={28} />
              <h2>Bestehende Welle – Regeln noch nicht umgestellt</h2>
              <p>
                Alte Punkte bleiben unverändert. Richte die neue
                Prozent-/Teilzielkonfiguration bewusst ein; erst Speichern
                übernimmt sie. Abgeschlossene Altquartale werden nicht
                umgerechnet.
              </p>
              {!!workspace.legacyTotals?.length && <section className={styles.card}><h2>Gespeicherter Altstand</h2><p>Bestehende Ergebnisse, nicht in Prozent umgerechnet und nicht nachträglich neu berechnet.</p><div className={styles.tableWrap}><table><thead><tr><th>GM</th><th>Alte Punkte</th><th>Gespeicherte Prämie</th></tr></thead><tbody>{workspace.legacyTotals.map(r=><tr key={r.gmId}><td>{r.name}</td><td>{decimal(r.totalPoints)}</td><td>{euro(r.earned)}</td></tr>)}</tbody></table></div></section>}
              {!frozen && canEdit && (
                <button
                  className={styles.primary}
                  onClick={async () => {
                    try {
                      setEditing(
                        (await api<{ model: WaveModel }>("/templates/empty"))
                          .model,
                      );
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                >
                  Neue Regeln einrichten
                </button>
              )}
            </div>
          ) : (
            <>
              <nav className={styles.tabs} aria-label="Prämienbereiche">
                {(
                  [
                    "Übersicht",
                    "Regeln & Quellen",
                    "Mitarbeiterwerte",
                    "Verlauf",
                  ] as Tab[]
                ).map((t) => (
                  <button
                    key={t}
                    aria-current={tab === t ? "page" : undefined}
                    className={tab === t ? styles.activeTab : ""}
                    onClick={() => setTab(t)}
                  >
                    {t}
                  </button>
                ))}
              </nav>
              {tab === "Übersicht" && (
                <>
                  <div className={styles.pillars}>
                    {workspace.model.pillars.map((p) => (
                      <article className={styles.card} key={p.key}>
                        <div className={styles.cardTitle}>
                          <span
                            className={styles.dot}
                            style={{ background: p.color }}
                          />
                          <h2>{p.name}</h2>
                          <button
                            aria-label={`${p.name} bearbeiten`}
                            disabled={frozen || !canEdit}
                            onClick={() => {
                              setEditingKey(p.key);
                              setEditing(structuredClone(workspace.model!));
                            }}
                          >
                            <Settings2 size={15} />
                          </button>
                        </div>
                        <div className={styles.big} style={{ color: p.color }}>
                          {euro(p.maxRewardEur)}
                          <span>Maximalprämie</span>
                        </div>
                        <div
                          className={styles.bar}
                          style={{
                            borderColor: p.color,
                            background: `${p.color}08`,
                          }}
                        >
                          <span
                            style={{
                              width: `${workspace.results.length ? (workspace.results.filter((r) => !r.pillars.find((x) => x.key === p.key)?.pending).length / workspace.results.length) * 100 : 0}%`,
                              borderColor: p.color,
                              background: `${p.color}35`,
                            }}
                          />
                        </div>
                        <p>
                          {
                            workspace.results.filter(
                              (r) =>
                                !r.pillars.find((x) => x.key === p.key)
                                  ?.pending,
                            ).length
                          }
                          /{workspace.results.length} bewertet ·{" "}
                          {p.metrics.length} Messgrößen
                        </p>
                        <small>
                          {p.payoutMode === "manual" ? p.metrics.filter(m => m.manualRewardCap !== undefined).map(m => `${m.label}: bis ${euro(m.manualRewardCap!)}`).join(" · ") : p.tiers.length
                            ? p.tiers.map((t) => t.label).join(" · ")
                            : "Stufen noch einzurichten"}
                        </small>
                      </article>
                    ))}
                  </div>
                  <section className={styles.card}>
                    <div className={styles.cardTitle}>
                      <Trophy size={18} />
                      <h2>Leaderboard</h2>
                      <div className={styles.segment}>
                        <button
                          className={
                            scope === "quarter" ? styles.activeTab : ""
                          }
                          onClick={() => setScope("quarter")}
                        >
                          Dieses Quartal
                        </button>
                        <button
                          className={scope === "total" ? styles.activeTab : ""}
                          onClick={() => setScope("total")}
                        >
                          Gesamt
                        </button>
                      </div>
                    </div>
                    <p>
                      {scope === "total"
                        ? "Nur eingefrorene Ergebnisse abgeschlossener Quartale. Keine Entwürfe oder laufenden Vorschauen."
                        : "Gleiche Prämie = gleicher Rang. Offene Teilziele sind in der Summe vorläufig."}
                    </p>
                    {scope === "total" ? (
                      <div className={styles.roster}>
                        {totals.map((r) => (
                          <div key={r.gmId}>
                            <span>
                              {totals.findIndex((x) => x.earned === r.earned) +
                                1}
                            </span>
                            <strong>{r.name}</strong>
                            <small>{r.quarters} Quartale</small>
                            <b>{euro(r.earned)}</b>
                          </div>
                        ))}
                        {!totals.length && (
                          <p>Noch keine abgeschlossenen Quartale.</p>
                        )}
                      </div>
                    ) : (
                      <div className={styles.roster}>
                        {workspace.results.map((r) => (
                          <button key={r.gmId} onClick={() => setGm(r)}>
                            <span className={styles.rank}>{r.rank}</span>
                            <strong>
                              {r.name} {!r.active && <small>Inaktiv</small>}
                            </strong>
                            <small>
                              {r.pending
                                ? "Vorläufig · Bewertung offen"
                                : "Bewertet"}
                            </small>
                            <b>{euro(r.earned)}</b>
                            <ChevronRight size={16} />
                          </button>
                        ))}
                      </div>
                    )}
                  </section>
                </>
              )}
              {tab === "Regeln & Quellen" && (
                <section className={styles.card}>
                  <div className={styles.cardTitle}>
                    <Settings2 size={18} />
                    <h2>Regeln & Quellen</h2>
                    {!frozen && canEdit && (
                      <button
                        className={styles.primary}
                        onClick={() =>
                          setEditing(structuredClone(workspace.model!))
                        }
                      >
                        Alle Säulen bearbeiten
                      </button>
                    )}
                  </div>
                  <p>{workspace.model.provenance}</p>
                  {workspace.model.pillars.map((p) => (
                    <div key={p.key} className={styles.ruleSummary}>
                      <h3 style={{ color: `color-mix(in srgb, ${p.color} 75%, #111827)` }}>
                        {p.name} · bis {euro(p.maxRewardEur)}
                      </h3>
                      <p>
                        {p.payoutMode === "manual" ? "Manuell festgelegte Teilprämien in Euro; leer bleibt offen, 0 € ist bewertet." : p.payoutMode === "groups"
                          ? "Je Teilziel die höchste Stufe, danach addieren."
                          : "Höchste erreichte Euro-Stufe; alle Bedingungen einer Stufe müssen erfüllt sein."}
                      </p>
                      {p.metrics.map((m) => (
                        <div key={m.key}>
                          <strong>{m.label}</strong>
                          <span>
                            {m.unit === "eur" ? "€" : m.unit === "percent"
                              ? "%"
                              : m.unit === "count"
                                ? "Anzahl"
                                : "Punkte"}{" "}
                            · {m.method === "manual" ? "Manuell" : m.method}{" "}
                            {m.target ? `· Soll ${decimal(m.target)}` : ""}
                          </span>
                          {m.hint && <small>{m.hint}</small>}
                          {m.manualRewardCap !== undefined && <small>Maximale Teilprämie: {euro(m.manualRewardCap)}</small>}
                          <small>
                            {m.sources
                              .map(
                                (s) =>
                                  `${s.label} · ${s.section} · ${s.counting === "once" ? "einmal pro Markt/Quartal" : "letzter Stand pro Markt/Quartal"} · Frequenz ≥ ${s.minFrequency}`,
                              )
                              .join(" | ")}
                          </small>
                        </div>
                      ))}
                      {p.tiers.map((t) => (
                        <p key={t.key}>
                          {t.group ? `${t.group}: ` : ""}
                          {t.conditions
                            .map(
                              (c) =>
                                conditionText(p, c),
                            )
                            .join(" UND ")}{" "}
                          → {euro(t.rewardEur)}
                        </p>
                      ))}
                    </div>
                  ))}
                </section>
              )}
              {tab === "Mitarbeiterwerte" && (
                <section className={styles.card}>
                  <div className={styles.cardTitle}>
                    <Award size={18} />
                    <h2>Mitarbeiterwerte</h2>
                    <input
                      aria-label="GM suchen"
                      placeholder="GM suchen …"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                    <BoniSelect
                      aria-label="Bewertungen filtern"
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                    >
                      <option value="all">Alle</option>
                      <option value="pending">Offene Bewertungen</option>
                      <option value="manual">Manuell bearbeitet</option>
                    </BoniSelect>
                  </div>
                  <p>
                    Einzelne Prozent-/Teilwerte bearbeiten. Leer = automatisch
                    bzw. offen. 0 ist eine echte Bewertung.
                  </p>
                  <div className={styles.tableWrap}>
                    <table>
                      <thead>
                        <tr>
                          <th>GM</th>
                          {workspace.model.pillars.map((p) => (
                            <th key={p.key}>{p.name}</th>
                          ))}
                          <th>Prämie</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r) => (
                          <tr key={r.gmId}>
                            <td>
                              <strong>{r.name}</strong>
                              {!r.active && <small>Inaktiv</small>}
                            </td>
                            {r.pillars.map((p) => (
                              <td key={p.key}>
                                <strong>{euro(p.earned)}</strong>
                                <small>
                                  {p.pending
                                    ? "Bewertung offen"
                                    : p.metrics.some(
                                          (m) => m.origin === "manual",
                                        )
                                      ? "Manuell bewertet"
                                      : "Automatisch"}
                                  {p.metrics
                                    .filter((m) => m.unit === "percent")
                                    .map(
                                      (m) =>
                                        ` · ${m.label}: ${decimal(m.value)}${m.value !== null ? "%" : ""}`,
                                    )
                                    .join("")}
                                </small>
                              </td>
                            ))}
                            <td>
                              <b>{euro(r.earned)}</b>
                              <small>
                                {r.pending ? "Vorläufig" : "Bestätigt"}
                              </small>
                            </td>
                            <td>
                              <button onClick={() => setGm(r)}>
                                {frozen ? "Ansehen" : "Werte bearbeiten"}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {!rows.length && <p>Keine passenden Mitarbeiter.</p>}
                </section>
              )}
              {tab === "Verlauf" && (
                <section className={styles.card}>
                  <h2>Änderungsverlauf</h2>
                  <p>
                    Regeln und Bewertungen mit Bearbeiter, Zeitpunkt und
                    Regelversion.
                  </p>
                  {workspace.history.map((h) => (
                    <details key={h.id} className={styles.history}>
                      <summary>
                        <span className={styles.badge}>V{h.revision}</span>{" "}
                        {h.type === "rules"
                          ? "Regeln gespeichert"
                          : h.type === "values"
                            ? "Werte bearbeitet"
                            : h.type === "activate"
                              ? "Welle aktiviert"
                              : "Quartal abgeschlossen"}{" "}
                        · {h.actor} · {new Date(h.at).toLocaleString("de-AT")}
                      </summary>
                      <pre>{JSON.stringify(h.payload, null, 2)}</pre>
                    </details>
                  ))}
                  {!workspace.history.length && <p>Noch keine Änderungen.</p>}
                </section>
              )}
            </>
          )}
        </>
      )}
      {!loading && !waves.length && !error && (
        <section className={styles.empty}>
          <Gift size={30} />
          <h2>Neue Prämienwelle einrichten</h2>
          <p>
            Mit frei bearbeitbaren Regeln oder einer nachvollziehbaren
            Quartalsvorlage starten.
          </p>
          <button
            className={styles.primary}
            disabled={!canCreate}
            onClick={() => setCreating(true)}
          >
            Welle erstellen
          </button>
        </section>
      )}
      {creating && (
        <CreateWave
          model={workspace?.model ?? null}
          onClose={() => setCreating(false)}
          onCreated={async (w) => {
            setCreating(false);
            setWorkspace(w);
            await loadWaves(w.wave.id);
          }}
        />
      )}
      {confirming && workspace && (
        <ConfirmWave
          action={confirming}
          busy={busy}
          onClose={() => setConfirming(null)}
          onConfirm={async () => {
            await save({ type: confirming });
            setConfirming(null);
          }}
        />
      )}
      {editing && workspace && (
        <ModelEditor
          initial={editing}
          firstPillar={editingKey}
          workspace={workspace}
          busy={busy}
          onClose={() => {
            setEditing(null);
            setEditingKey(undefined);
          }}
          onSave={async (model) => {
            await save({ type: "rules", model });
            setEditing(null);
            setEditingKey(undefined);
          }}
        />
      )}
      {gm && workspace && (
        <GmValues
          readOnly={!canEdit}
          gm={gm}
          workspace={workspace}
          busy={busy}
          onClose={() => setGm(null)}
          onSave={async (entries) => {
            await save({ type: "values", entries });
            setGm(null);
          }}
        />
      )}
    </div>
  );
}

function ConfirmWave({
  action,
  busy,
  onClose,
  onConfirm,
}: {
  action: "activate" | "archive";
  busy: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  useDialog(() => {
    if (!busy) onClose();
  });
  const [error, setError] = useState("");
  const title =
    action === "archive"
      ? "Quartal verbindlich abschließen"
      : "Prämienwelle aktivieren";
  return (
    <div className={styles.backdrop}>
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={styles.dialog}
      >
        <header>
          <h2>{title}</h2>
          <button aria-label="Schließen" disabled={busy} onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <div className={styles.dialogBody}>
          <p>
            {action === "archive"
              ? "Regeln und Ergebnisse aller GMs werden als unveränderlicher Stand gespeichert. Spätere Besuchskorrekturen ändern dieses Quartal nicht mehr. Alle benötigten Bewertungen müssen vollständig sein."
              : "Diese Regeln gelten für alle GMs im Zeitraum. Die laufende Auswertung berücksichtigt gültige Besuche und ausdrücklich gespeicherte Bewertungen."}
          </p>
          <p className={styles.notice}>
            Die berechnete Prämie ist keine ausgeführte Auszahlung.
          </p>
          {error && (
            <p role="alert" className={styles.error}>
              {error}
            </p>
          )}
        </div>
        <footer>
          <button disabled={busy} onClick={onClose}>
            Abbrechen
          </button>
          <button
            className={styles.primary}
            disabled={busy}
            onClick={async () => {
              setError("");
              try {
                await onConfirm();
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            {action === "archive"
              ? "Abschluss bestätigen"
              : "Aktivierung bestätigen"}
          </button>
        </footer>
      </section>
    </div>
  );
}

function CreateWave({
  model,
  onCreated,
  onClose,
}: {
  model: WaveModel | null;
  onCreated: (w: Workspace) => Promise<void>;
  onClose: () => void;
}) {
  useDialog(() => {
    if (!busy) onClose();
  });
  const [name, setName] = useState(""),
    [year, setYear] = useState(new Date().getFullYear()),
    [quarter, setQuarter] = useState(Math.floor(new Date().getMonth() / 3) + 1),
    [template, setTemplate] = useState(model ? "copy" : "empty"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <div className={styles.backdrop}>
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Neue Prämienwelle"
        className={styles.dialog}
      >
        <header>
          <h2>Neue Prämienwelle</h2>
          <button aria-label="Schließen" onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <div className={styles.dialogBody}>
          <label>
            Name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={`Prämienwelle Q${quarter} ${year}`}
            />
          </label>
          <div className={styles.twoColumns}>
            <label>
              Jahr
              <input
                type="number"
                min="2020"
                max="2100"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
              />
            </label>
            <label>
              Quartal
              <BoniSelect
                value={quarter}
                onChange={(e) => setQuarter(Number(e.target.value))}
              >
                {[1, 2, 3, 4].map((q) => (
                  <option key={q} value={q}>
                    Q{q}
                  </option>
                ))}
              </BoniSelect>
            </label>
          </div>
          <label>
            Regelvorlage
            <BoniSelect
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
            >
              <option value="empty">Leer – frei einrichten</option>
              <option value="q1">Q1 2026 · belegte Vorlage</option>
              <option value="q2">Q2 2026 · belegte Vorlage</option>
              <option value="xmas">Kühler + X-Mas · 25 / 30 Punkte · manuelle Qualität</option>
              <option value="q3">
                Q3 · Kühler & permanente Racks (Stufen offen)
              </option>
              {model && (
                <option value="copy">
                  Regeln der geöffneten Welle kopieren
                </option>
              )}
            </BoniSelect>
          </label>
          <p className={styles.notice}>
            Nur Regeln werden übernommen – keine Istwerte, Bewertungen oder
            Auszahlungen. Die Kühler-/X-Mas-Vorlage enthält manuelle Qualitätsprämien; ältere Vorlagen behalten ihre offenen Qualitätsregeln.
          </p>
          {error && (
            <p role="alert" className={styles.error}>
              {error}
            </p>
          )}
        </div>
        <footer>
          <button onClick={onClose} disabled={busy}>
            Abbrechen
          </button>
          <button
            className={styles.primary}
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                const w = await api<Workspace>(
                  "/waves",
                  {
                    name: name || `Prämienwelle Q${quarter} ${year}`,
                    year,
                    quarter,
                    template: template === "copy" ? "empty" : template,
                    ...(template === "copy" && model ? { model } : {}),
                  },
                  "POST",
                );
                await onCreated(w);
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Entwurf erstellen
          </button>
        </footer>
      </section>
    </div>
  );
}

function GmValues({
  readOnly,
  gm,
  workspace,
  busy,
  onSave,
  onClose,
}: {
  readOnly: boolean;
  gm: GmResult;
  workspace: Workspace;
  busy: boolean;
  onSave: (e: MetricEntry[]) => Promise<void>;
  onClose: () => void;
}) {
  useDialog(() => {
    if (!busy) onClose();
  });
  const frozen = workspace.wave.status === "archived" || readOnly;
  const [draft, setDraft] = useState<
    Record<string, { value: string; target: string; note: string }>
  >(() =>
    Object.fromEntries(
      gm.pillars.flatMap((p) =>
        p.metrics.map((m) => {
          const e = workspace.entries.find(
            (e) =>
              e.gmId === gm.gmId &&
              e.pillarKey === p.key &&
              e.metricKey === m.key,
          );
          return [
            `${p.key}/${m.key}`,
            {
              value: e?.value == null ? "" : String(e.value).replace(".", ","),
              target:
                e?.target == null ? "" : String(e.target).replace(".", ","),
              note: e?.note ?? "",
            },
          ];
        }),
      ),
    ),
  );
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<GmResult | null>(null),
    [checking, setChecking] = useState(false);
  const draftVersion = useRef(0);
  function changes(): MetricEntry[] {
    return gm.pillars
      .flatMap((p) =>
        p.metrics.map((m) => {
          const d = draft[`${p.key}/${m.key}`];
          const value = parseDecimal(d.value),
            target = parseDecimal(d.target);
          if (
            (value !== null && !Number.isFinite(value)) ||
            (target !== null && (!Number.isFinite(target) || target <= 0))
          )
            throw new Error(
              "Bitte gültige Zahlen eingeben; Sollwerte müssen größer als 0 sein.",
            );
          const def = workspace.model?.pillars.find(x => x.key === p.key)?.metrics.find(x => x.key === m.key);
          if (value !== null && def && ((def.minValue !== undefined && value < def.minValue) || (def.maxValue !== undefined && value > def.maxValue) || (def.integerOnly && !Number.isInteger(value))))
            throw new Error(`${m.label}: Bitte einen Wert im zulässigen Bereich eingeben${def.manualRewardCap !== undefined ? ` (0 bis ${euro(def.manualRewardCap)})` : ""}.`);
          return {
            gmId: gm.gmId,
            pillarKey: p.key,
            metricKey: m.key,
            value,
            target,
            note: d.note,
          };
        }),
      )
      .filter((e) => {
        const before = workspace.entries.find(
          (b) =>
            b.gmId === e.gmId &&
            b.pillarKey === e.pillarKey &&
            b.metricKey === e.metricKey,
        );
        return (
          (before?.value ?? null) !== e.value ||
          (before?.target ?? null) !== e.target ||
          (before?.note ?? "") !== e.note
        );
      });
  }
  function field(id: string, name: "value" | "target" | "note", value: string) {
    draftVersion.current++;
    setPreview(null);
    setDraft((d) => ({ ...d, [id]: { ...d[id], [name]: value } }));
  }
  return (
    <div className={styles.backdrop}>
      <section
        role="dialog"
        aria-modal="true"
        aria-label={`Werte für ${gm.name}`}
        className={styles.drawer}
      >
        <header>
          <div>
            <span className={styles.eyebrow}>MITARBEITERWERTE</span>
            <h2>{gm.name}</h2>
            <p>
              {euro(gm.earned)}
              {gm.pending ? " · vorläufig" : ""}
            </p>
          </div>
          <button aria-label="Schließen" onClick={onClose}>
            <X size={20} />
          </button>
        </header>
        <div className={styles.dialogBody}>
          {gm.pillars.map((p) => (
            <section key={p.key} className={styles.ruleSummary}>
              <h3 style={{ color: `color-mix(in srgb, ${p.color} 75%, #111827)` }}>
                {p.name}
                <span className={styles.right}>{euro(p.earned)}</span>
              </h3>
              {p.metrics.map((m) => {
                const id = `${p.key}/${m.key}`,
                  d = draft[id],
                  definition = workspace.model?.pillars
                    .find((x) => x.key === p.key)
                    ?.metrics.find((x) => x.key === m.key);
                return (
                  <div key={m.key} className={styles.metricValue}>
                    <div>
                      <strong>{m.label}</strong>
                      <small>
                        {m.origin === "manual"
                          ? `Manuell · ${m.actorName ?? ""} · ${m.updatedAt ? new Date(m.updatedAt).toLocaleString("de-AT") : ""}`
                          : m.origin === "pending"
                            ? "Noch nicht bewertet / nicht auswertbar"
                            : "Automatisch"}{" "}
                        · wirksam: {definition?.confirmation ? m.value === null ? "Prüfung offen" : m.value === 1 ? "Bestätigt" : "Nicht erfüllt" : `${decimal(m.value)} ${metricUnit(m.unit)}`}
                      </small>
                      <small>
                        Automatisch: {decimal(m.automatic)}
                        {m.counted
                          ? ` · ${m.counted} gezählt, ${m.excluded} nicht zusätzlich gezählt`
                          : ""}
                      </small>
                    </div>
                    {definition?.hint && <p className={styles.notice}>{definition.hint}</p>}
                    {definition?.manualRewardCap !== undefined && <p>Maximalprämie: {euro(definition.manualRewardCap)} {!frozen && <button onClick={() => field(id, "value", String(definition.manualRewardCap).replace(".", ","))}>Volle Teilprämie übernehmen</button>}</p>}
                    {definition?.confirmation ? <label>Nachweise geprüft<BoniSelect aria-label={m.label} value={d.value} disabled={frozen} onChange={e => field(id, "value", e.target.value)}><option value="">Prüfung offen</option><option value="1">Bestätigt · Voraussetzungen erfüllt</option><option value="0">Nicht erfüllt</option></BoniSelect></label> : definition?.readOnly ? <p>Wird aus den erfassten Werten berechnet: {decimal(m.value)} {metricUnit(m.unit)}</p> : <div className={styles.twoColumns}>
                      <label>
                        {m.unit === "eur" ? "Manuelle Auszahlung in €" : m.unit === "percent"
                          ? "Manuell in %"
                          : m.unit === "count"
                            ? "Manuell in Stück"
                            : "Manuell in Punkten"}
                        <input
                          inputMode="decimal"
                          aria-label={m.label}
                          value={d.value}
                          onChange={(e) => field(id, "value", e.target.value)}
                          placeholder={
                            definition?.method === "manual"
                              ? "offen"
                              : "automatisch"
                          }
                          disabled={frozen}
                        />
                      </label>
                      {["ratio", "availability"].includes(
                        definition?.method ?? "",
                      ) && (
                        <label>
                          Persönlicher Sollwert
                          <input
                            inputMode="decimal"
                            value={d.target}
                            onChange={(e) =>
                              field(id, "target", e.target.value)
                            }
                            placeholder={
                              m.target === null
                                ? "Soll fehlt"
                                : String(m.target)
                            }
                            disabled={frozen}
                          />
                        </label>
                      )}
                    </div>}
                    {definition?.method === "ratio" &&
                      workspace.model?.pillars.find((x) => x.key === p.key)
                        ?.kind === "displays" &&
                      !frozen && (
                        <PersonalTarget
                          onTarget={(value, note) => {
                            field(id, "target", value);
                            field(id, "note", note);
                          }}
                        />
                      )}
                    <label>
                      Begründung / Nachweis
                      <input
                        value={d.note}
                        onChange={(e) => field(id, "note", e.target.value)}
                        disabled={frozen}
                      />
                    </label>
                    {!frozen && !definition?.readOnly && (
                      <button onClick={() => field(id, "value", "")}>
                        {definition?.method === "manual"
                          ? "Bewertung entfernen"
                          : "Zur Automatik"}
                      </button>
                    )}
                  </div>
                );
              })}
            </section>
          ))}
          {preview && (
            <section className={styles.preview}>
              <h3>Vorschau – noch nicht gespeichert</h3>
              <p>
                {euro(gm.earned)} → <strong>{euro(preview.earned)}</strong>
                {preview.pending ? " · Bewertung offen" : ""}
              </p>
              {preview.pillars.map((p) => (
                <p key={p.key}>
                  {p.name}: {euro(p.earned)} {p.pending ? "· offen" : ""}
                </p>
              ))}
            </section>
          )}
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
        </div>
        <footer>
          <button onClick={onClose}>Schließen</button>
          {!frozen && (
            <button
              disabled={busy || checking}
              onClick={async () => {
                setError("");
                setChecking(true);
                const version = draftVersion.current;
                try {
                  const result = await api<Workspace>(
                    `/waves/${workspace.wave.id}/preview`,
                    { model: workspace.model, entries: changes() },
                    "POST",
                  );
                  if (version === draftVersion.current)
                    setPreview(
                      result.results.find((r) => r.gmId === gm.gmId) ?? null,
                    );
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setChecking(false);
                }
              }}
            >
              Werte prüfen
            </button>
          )}
          {!frozen && (
            <button
              className={styles.primary}
              disabled={busy || checking}
              onClick={async () => {
                setError("");
                try {
                  const entries = changes();
                  if (!entries.length) {
                    onClose();
                    return;
                  }
                  await onSave(entries);
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              Werte speichern & neu berechnen
            </button>
          )}
        </footer>
      </section>
    </div>
  );
}
function PersonalTarget({
  onTarget,
}: {
  onTarget: (s: string, note: string) => void;
}) {
  const [base, setBase] = useState("145"),
    [days, setDays] = useState("60"),
    [absence, setAbsence] = useState("0");
  return (
    <details>
      <summary>Sollwert mit Abwesenheit berechnen</summary>
      <div className={styles.threeColumns}>
        <label>
          Basis-Soll
          <input
            inputMode="decimal"
            value={base}
            onChange={(e) => setBase(e.target.value)}
          />
        </label>
        <label>
          Arbeitstage
          <input
            inputMode="decimal"
            value={days}
            onChange={(e) => setDays(e.target.value)}
          />
        </label>
        <label>
          Abwesenheitstage
          <input
            inputMode="decimal"
            value={absence}
            onChange={(e) => setAbsence(e.target.value)}
          />
        </label>
      </div>
      <button
        onClick={() => {
          const b = parseDecimal(base),
            d = parseDecimal(days),
            a = parseDecimal(absence);
          if (b && d && d > 0 && a !== null && a >= 0 && a < d)
            onTarget(
              String(Math.round(((b * (d - a)) / d) * 10000) / 10000).replace(
                ".",
                ",",
              ),
              `Basis-Soll ${base}, ${days} Arbeitstage, ${absence} Abwesenheitstage; Soll = Basis × (Arbeitstage − Abwesenheit) / Arbeitstage.`,
            );
        }}
      >
        Wirksames Soll übernehmen
      </button>
      <small>
        Manuell bestätigt, nicht automatisch aus Zeiterfassungs-Tätigkeiten
        abgeleitet. Basis und Tage bitte als Begründung festhalten.
      </small>
    </details>
  );
}
