"use client";
import { useState } from "react";
import { saveAuthSession, type AuthSessionPayload } from "@/lib/api/backend";
import { ArrowRight, FlaskConical } from "lucide-react";
import styles from "./praemien.module.css";

export function PraemienFixtureEntry() {
  const [error, setError] = useState(""), [busy, setBusy] = useState(false);
  return <main className={styles.page} style={{ maxWidth: 620, margin: "90px auto" }}><section className={styles.card}>
    <div className={styles.heading}><FlaskConical className={styles.icon} size={48} /><div><div className={styles.eyebrow}>ISOLIERTE VORSCHAU</div><h1>Boni · UI-Test</h1></div></div>
    <p>120 Testfragen, synthetische Mitarbeiter und eine Datenbank im Arbeitsspeicher. Alle Änderungen bleiben in dieser Vorschau.</p>
    <button className={styles.primary} disabled={busy} onClick={async () => {
      setBusy(true); setError("");
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/fixture-session`);
        if (!response.ok) throw new Error("Isolierter Testserver nicht erreichbar.");
        saveAuthSession(await response.json() as AuthSessionPayload, { remember: false });
        window.location.assign("/admin/praemien");
      } catch (e) { setError((e as Error).message); setBusy(false); }
    }}>Boni-Vorschau öffnen <ArrowRight size={14} /></button>
    {error && <p className={styles.error} role="alert">{error}</p>}
  </section></main>;
}
