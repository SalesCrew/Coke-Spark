"use client";
import { useState } from "react";
import Link from "next/link";
import { requestPraemienWorkspace as api } from "@/lib/api/backend";
import type { ModelSource } from "@/types/praemien-workspace";

export function PraemienQuestionUsage({
  questionId,
  scoring,
}: {
  questionId: string;
  scoring: Record<string, { boni?: number | null }>;
}) {
  const [usage, setUsage] = useState<
      | {
          waveName: string;
          status: string;
          pillar: string;
          metric: string;
          unit: string;
          source: ModelSource;
        }[]
      | null
    >(null),
    [error, setError] = useState("");
  return (
    <details
      style={{ marginTop: 12, borderTop: "1px solid #eee", paddingTop: 10 }}
      onToggle={async (e) => {
        if (!e.currentTarget.open || usage) return;
        try {
          setUsage(
            (
              await api<{ usage: NonNullable<typeof usage> }>(
                `/sources/${questionId}/usage`,
              )
            ).usage,
          );
        } catch (err) {
          setError((err as Error).message);
        }
      }}
    >
      <summary
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: "#64748b",
          cursor: "pointer",
        }}
      >
        Prämienzuordnung prüfen
      </summary>
      <div
        style={{
          fontSize: 10,
          lineHeight: 1.7,
          color: "#64748b",
          paddingTop: 8,
        }}
      >
        <p>
          Boni-Gewichte sind Punkte/Faktoren, keine Euro. Quartalsregeln und
          Quellen werden unter Prämien bewusst eingerichtet.
        </p>
        {usage?.map((u, i) => {
          const live = scoring[u.source.scoreKey]?.boni;
          const mismatch = live != null && Number(live) !== u.source.weight;
          return (
            <div
              key={i}
              style={{
                margin: "8px 0",
                padding: 8,
                border: "1px solid #eee",
                borderRadius: 6,
              }}
            >
              <strong>
                {u.waveName} ·{" "}
                {u.status === "archived"
                  ? "eingefroren"
                  : u.status === "active"
                    ? "laufend"
                    : "Entwurf"}
              </strong>
              <div>
                {u.pillar} → {u.metric} · {u.unit} ·{" "}
                {u.source.counting === "once"
                  ? "einmal pro Markt/Quartal"
                  : "letzter Marktstand/Quartal"}
              </div>
              {mismatch && u.status !== "archived" && (
                <div style={{ color: "#b45309" }}>
                  Fragengewicht geändert: Welle {u.source.weight}, Frage {live}.
                  Regelzuordnung prüfen; keine automatische Geldänderung.
                </div>
              )}
            </div>
          );
        })}
        {usage?.length === 0 && (
          <p>In den neuen Quartalsregeln noch keiner Messgröße zugeordnet.</p>
        )}
        {error && <p>{error}</p>}
        <p>
          Duplizierte Module können dieselbe technische Frage verwenden. Eine
          Quelle wird nicht allein durch Kopieren erneut vergütet.
        </p>
        <Link href="/admin/praemien">Regeln & Quellen öffnen →</Link>
      </div>
    </details>
  );
}
