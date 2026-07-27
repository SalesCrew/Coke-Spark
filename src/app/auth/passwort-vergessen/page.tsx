"use client";

import { Inter_Tight } from "next/font/google";
import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, Mail, Send } from "lucide-react";
import { createRecoveryClient } from "@/lib/supabase/client";
import "../../../components/login.css";

const loginFont = Inter_Tight({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

function resolveResetOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (configured) return configured;
  if (typeof window === "undefined") return "";
  return window.location.origin.replace(/\/$/, "");
}

function ForgotPasswordInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialEmail = useMemo(() => String(searchParams.get("email") || "").trim(), [searchParams]);
  const [email, setEmail] = useState(initialEmail);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const supabase = useMemo(() => createRecoveryClient(), []);

  const handleSend = async (event: React.FormEvent) => {
    event.preventDefault();
    const normalizedEmail = email.trim();
    setError(null);
    setSent(false);

    if (!normalizedEmail) {
      setError("Bitte gib deine E-Mail ein.");
      return;
    }

    try {
      setBusy(true);
      const redirectTo = `${resolveResetOrigin()}/auth/reset-password`;
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(normalizedEmail, { redirectTo });
      if (resetError) throw resetError;
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset-Link konnte nicht gesendet werden.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`${loginFont.className} cs-login-page`}>
      <aside className="cs-brand">
        <div className="cs-brand-hero">
          <div className="cs-eyebrow"><span className="dot" />Account Recovery</div>
          <h1 className="cs-headline">
            Coke Spark
            <em>Reset.</em>
          </h1>
          <p className="cs-sub">Wir senden dir einen sicheren Supabase-Link zum Zurücksetzen deines Passworts.</p>
        </div>
        <div className="cs-brand-foot">
          <span>© 2026 Merchandising Company. Internal use only.</span>
        </div>
      </aside>

      <main className="cs-login-pane">
        <section className="cs-scaffold">
          <header className="cs-form-head">
            <button
              type="button"
              onClick={() => router.push("/")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                width: "fit-content",
                border: "none",
                background: "transparent",
                color: "rgba(255,255,255,0.76)",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                padding: 0,
                marginBottom: 18,
              }}
            >
              <ArrowLeft size={14} />
              Zurück zum Login
            </button>
            <h2 className="cs-form-title">Passwort vergessen</h2>
            <p className="cs-form-sub">Gib deine Arbeits-E-Mail ein. Der Link führt dich direkt zur neuen Passwort-Seite.</p>
          </header>

          <form className="cs-form-card" onSubmit={handleSend} noValidate>
            <div className="cs-fields">
              <div className="cs-field">
                <label htmlFor="reset-email" className="cs-label">Email</label>
                <div className={"cs-input-wrap" + (error ? " has-error" : "")}>
                  <span className="cs-input-icon">
                    <Mail size={16} strokeWidth={1.8} />
                  </span>
                  <input
                    id="reset-email"
                    className="cs-input"
                    type="email"
                    autoComplete="username"
                    placeholder="name@merch.at"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </div>
              </div>

              {error && <div className="cs-help" role="alert">{error}</div>}
              {sent && (
                <div className="cs-help" style={{ color: "#047857", background: "rgba(16,185,129,0.08)", borderColor: "rgba(16,185,129,0.2)" }}>
                  <CheckCircle2 size={14} />
                  Wenn die E-Mail existiert, wurde ein Reset-Link gesendet.
                </div>
              )}
            </div>

            <button type="submit" className={"cs-primary" + (busy ? " loading" : "")} disabled={busy}>
              <span className="cs-primary-label">
                {busy ? "Sende Link..." : "Reset-Link senden"} <Send size={14} />
              </span>
              <span className="cs-spinner" aria-hidden="true" />
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<div className={`${loginFont.className} cs-login-page`} />}>
      <ForgotPasswordInner />
    </Suspense>
  );
}
