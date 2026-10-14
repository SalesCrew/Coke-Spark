"use client";

import { Check } from "lucide-react";
import type { MarketType } from "@/types/markets";
import { toggleMarketClassification } from "@/lib/markets/marketClassification";
import styles from "./MarketClassificationControl.module.css";

export function MarketClassificationControl({ value, disabled, onChange }: {
  value: MarketType; disabled?: boolean; onChange: (value: MarketType) => void;
}) {
  return (
    <div>
      <div className={styles.options} role="group" aria-label="Markt-Typ">
        {(["kuehler", "universum"] as const).map(type => {
          const selected = value === type || value === "both";
          const lastSelected = value === type;
          return (
            <button key={type} type="button" aria-pressed={selected}
              disabled={disabled || lastSelected}
              title={lastSelected ? "Mindestens ein Markt-Typ muss ausgewählt bleiben." : undefined}
              onClick={() => onChange(toggleMarketClassification(value, type))}
              className={`${styles.option} ${selected ? styles.selected : ""}`}>
              <span className={styles.check}>{selected && <Check size={11} strokeWidth={2.5} />}</span>
              {type === "kuehler" ? "Kühler" : "Universum"}
            </button>
          );
        })}
      </div>
      <p className={styles.hint}>Beide möglich. Mindestens ein Markt-Typ bleibt ausgewählt.</p>
    </div>
  );
}
