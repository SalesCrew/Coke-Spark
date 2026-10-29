"use client";

import styles from "./GmClassification.module.css";

/** Account classification only; both choices keep the normal GM role. */
export function GmClassification({ value, onChange, disabled = false, editing = false }: {
  value: boolean;
  onChange: (supplemental: boolean) => void;
  disabled?: boolean;
  editing?: boolean;
}) {
  return (
    <fieldset className={styles.field} disabled={disabled}>
      <legend>GM-Zuordnung</legend>
      <div className={styles.options}>
        {[false, true].map(supplemental => (
          <label key={String(supplemental)} className={styles.option} data-selected={value === supplemental}>
            <input type="radio" name={editing ? "edit-gm-classification" : "create-gm-classification"}
              checked={value === supplemental} onChange={() => onChange(supplemental)} />
            <span className={styles.radio} aria-hidden="true" />
            <span>{supplemental ? "Zusatz-GM" : "Regulärer GM"}</span>
            {supplemental && <span className={styles.budget}>Separates Budget</span>}
          </label>
        ))}
      </div>
      <p>{value ? "Gleiche Funktionen. Besuche separat vom GM-Dashboard, weiterhin im Export." : "Besuche fließen in das reguläre GM-Dashboard ein."}
        {editing && <span> Gilt für neue Besuche. Frühere Zuordnungen bleiben erhalten.</span>}</p>
    </fieldset>
  );
}
