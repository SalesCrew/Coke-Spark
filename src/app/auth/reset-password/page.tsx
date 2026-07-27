"use client";

import { Inter_Tight } from "next/font/google";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";
import { createClient, createRecoveryClient } from "@/lib/supabase/client";
import "../../../components/login.css";

const loginFont = Inter_Tight({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

type ResetStage = "checking" | "ready" | "saving" | "done" | "invalid";

function sanitizeReturnTo(value: string | null): string {
  const candidate = String(value || "").trim();
  return candidate.startsWith("/") ? candidate : "/";
}

function ResetPasswordInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const recoveryCode = searchParams.get("code");
  const returnTo = useMemo(() => sanitizeReturnTo(searchParams.get("returnTo")), [searchParams]);
  const supabase = useMemo(
    () => recoveryCode ? createClient() : createRecoveryClient(),
    [recoveryCode],
  );
  const [stage, setStage] = useState<ResetStage>("checking");
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    let mounted = true;

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        setStage("ready");
        setError(null);
      }
    });

    const init = async () => {
      try {
        setStage("checking");
        setError(null);

        if (recoveryCode) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(recoveryCode);
          if (exchangeError) {
            const message = String(exchangeError.message || "");
            if (/pkce code verifier not found/i.test(message)) {
              throw new Error("Dieser ältere Link ist browsergebunden. Bitte fordere einen neuen Reset-Link an; neue Links funktionieren auch auf einem anderen Gerät.");
            }
            throw exchangeError;
          }
        }

        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!mounted) return;
        if (data.session) {
          setStage("ready");
          return;
        }

        const hash = window.location.hash || "";
        const hasRecoveryHash = /access_token=|type=recovery/i.test(hash);
        if (hasRecoveryHash) {
          await new Promise((resolve) => setTimeout(resolve, 650));
          const retry = await supabase.auth.getSession();
          if (!mounted) return;
          if (retry.data.session) {
            setStage("ready");
            return;
          }
        }

        setStage("invalid");
        setError("Der Link ist ungültig oder abgelaufen. Bitte fordere einen neuen Reset-Link an.");
      } catch (err) {
        if (!mounted) return;
        setStage("invalid");
        setError(err instanceof Error ? err.message : "Recovery-Link konnte nicht verarbeitet werden.");
      }
    };

    void init();

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [recoveryCode, supabase]);

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Bitte mindestens 8 Zeichen verwenden.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwörter stimmen nicht überein.");
      return;
    }

    try {
      setStage("saving");
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      await supabase.auth.signOut();
      setStage("done");
    } catch (err) {
      setStage("ready");
      setError(err instanceof Error ? err.message : "Passwort konnte nicht gespeichert werden.");
    }
  };

  const goToLogin = () => router.push(returnTo);

  return (
    <div className={`${loginFont.className} cs-login-page`}>
      <aside className="cs-brand">
        <div className="cs-brand-hero">
          <div className="cs-eyebrow"><span className="dot" />Secure Reset</div>
          <h1 className="cs-headline">
            Coke Spark
            <em>New key.</em>
          </h1>
          <p className="cs-sub">Setze dein neues Passwort und melde dich danach wie gewohnt an.</p>
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
              onClick={goToLogin}
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
            <h2 className="cs-form-title">Neues Passwort</h2>
            <p className="cs-form-sub">Gib dein neues Passwort ein und bestätige es einmal.</p>
          </header>

          <div className="cs-form-card">
            {stage === "checking" && (
              <div className="cs-help" style={{ justifyContent: "center", color: "rgba(0,0,0,0.62)" }}>
                <Loader2 size={15} className="animate-spin" />
                Recovery-Link wird geprüft...
              </div>
            )}

            {stage === "invalid" && (
              <div className="cs-fields">
                <div className="cs-help" role="alert">{error || "Der Link ist ungültig."}</div>
                <button
                  type="button"
                  className="cs-primary"
                  onClick={() => router.push(`/auth/passwort-vergessen?returnTo=${encodeURIComponent(returnTo)}`)}
                >
                  <span className="cs-primary-label">Neuen Link anfordern</span>
                </button>
              </div>
            )}

            {(stage === "ready" || stage === "saving") && (
              <form onSubmit={handleSave} className="cs-fields" noValidate>
                <div className="cs-field">
                  <label htmlFor="new-password" className="cs-label">Neues Passwort</label>
                  <div className={"cs-input-wrap" + (error ? " has-error" : "")}>
                    <span className="cs-input-icon">
                      <KeyRound size={16} strokeWidth={1.8} />
                    </span>
                    <input
                      id="new-password"
                      className="cs-input"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      placeholder="Mindestens 8 Zeichen"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                    />
                    <button type="button" className="cs-input-action" onClick={() => setShowPassword((value) => !value)} aria-label="Passwort anzeigen">
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="cs-field">
                  <label htmlFor="confirm-password" className="cs-label">Passwort bestätigen</label>
                  <div className={"cs-input-wrap" + (error ? " has-error" : "")}>
                    <span className="cs-input-icon">
                      <KeyRound size={16} strokeWidth={1.8} />
                    </span>
                    <input
                      id="confirm-password"
                      className="cs-input"
                      type={showConfirm ? "text" : "password"}
                      autoComplete="new-password"
                      placeholder="Passwort wiederholen"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                    />
                    <button type="button" className="cs-input-action" onClick={() => setShowConfirm((value) => !value)} aria-label="Bestätigung anzeigen">
                      {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {error && <div className="cs-help" role="alert">{error}</div>}

                <button type="submit" className={"cs-primary" + (stage === "saving" ? " loading" : "")} disabled={stage === "saving"}>
                  <span className="cs-primary-label">{stage === "saving" ? "Speichert..." : "Passwort speichern"}</span>
                  <span className="cs-spinner" aria-hidden="true" />
                </button>
              </form>
            )}

            {stage === "done" && (
              <div className="cs-fields">
                <div className="cs-help" style={{ color: "#047857", background: "rgba(16,185,129,0.08)", borderColor: "rgba(16,185,129,0.2)" }}>
                  <CheckCircle2 size={14} />
                  Passwort wurde geändert. Du kannst dich jetzt einloggen.
                </div>
                <button type="button" className="cs-primary" onClick={goToLogin}>
                  <span className="cs-primary-label">Zum Login</span>
                </button>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className={`${loginFont.className} cs-login-page`} />}>
      <ResetPasswordInner />
    </Suspense>
  );
}
