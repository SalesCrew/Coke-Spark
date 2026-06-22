"use client";

import { useCallback, useState, type FormEvent, type ReactNode } from "react";
import RotatingText from "./RotatingText";
import "./login.css";

export interface LoginCredentials {
  email: string;
  password: string;
  remember: boolean;
}

export interface LoginProps {
  onSubmit?: (creds: LoginCredentials) => Promise<void> | void;
  onForgot?: (email?: string) => void;
  headline?: ReactNode;
  subHeadline?: string;
}

const IconMail = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="5" width="18" height="14" rx="2.5" />
    <path d="m3 7 9 7 9-7" />
  </svg>
);

const IconLock = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </svg>
);

const IconEye = ({ off = false }: { off?: boolean }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
    {off && <path d="m4 4 16 16" />}
  </svg>
);

const IconCheck = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="5 12 10 17 19 7" />
  </svg>
);

const IconArrow = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14" />
    <polyline points="13 6 19 12 13 18" />
  </svg>
);

const IconAlert = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v4" />
    <path d="M12 16h.01" />
  </svg>
);

export default function Login({
  onSubmit,
  onForgot,
  headline,
  subHeadline = "Sign in to access markets, campaigns and performance - all in one place.",
}: LoginProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setError(null);

      if (!email.trim() || !password) {
        setError("Bitte E-Mail und Passwort eingeben.");
        return;
      }

      try {
        setLoading(true);
        await onSubmit?.({ email: email.trim(), password, remember });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Anmeldung fehlgeschlagen. Bitte erneut versuchen.");
      } finally {
        setLoading(false);
      }
    },
    [email, password, remember, onSubmit],
  );

  return (
    <div className="cs-login-page">
      <aside className="cs-brand">
        <div className="cs-brand-hero">
          <div className="cs-eyebrow"><span className="dot" />Welcome to Coke Spark</div>
          <h1 className="cs-headline">
            {headline ?? (
              <>
                Coke Spark
                <em>
                  Every{" "}
                  <RotatingText
                    texts={["shelf.", "visit."]}
                    rotationInterval={3000}
                    staggerFrom="last"
                    initial={{ y: "100%" }}
                    animate={{ y: 0 }}
                    exit={{ y: "-120%" }}
                    staggerDuration={0.025}
                    transition={{ type: "spring", damping: 30, stiffness: 400 }}
                    mainClassName="cs-switch-wrap accent"
                    splitLevelClassName="cs-switch-word"
                    elementLevelClassName="cs-switch-element"
                    aria-live="polite"
                  />
                </em>
              </>
            )}
          </h1>
          <p className="cs-sub">{subHeadline}</p>
        </div>

        <div className="cs-brand-foot">
          <span>© 2026 Merchandising Company. Internal use only.</span>
        </div>
      </aside>

      <main className="cs-login-pane">
        <div>
          <section className="cs-scaffold">
            <header className="cs-form-head">
              <h2 className="cs-form-title">Welcome back</h2>
              <p className="cs-form-sub">
                Sign in with your work email. We&apos;ll route you to the right workspace.
              </p>
            </header>

            <form className="cs-form-card" onSubmit={handleSubmit} noValidate>
              <div className="cs-fields">
                <div className="cs-field">
                  <label htmlFor="cs-email" className="cs-label">
                    Email
                  </label>
                  <div className={"cs-input-wrap" + (error ? " has-error" : "")}>
                    <span className="cs-input-icon">
                      <IconMail />
                    </span>
                    <input
                      id="cs-email"
                      className="cs-input"
                      type="email"
                      autoComplete="username"
                      placeholder="name@cokespark.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </div>

                <div className="cs-field">
                  <label htmlFor="cs-pass" className="cs-label">
                    Password
                    <button type="button" className="cs-link hint" onClick={() => onForgot?.(email.trim())}>
                      Forgot?
                    </button>
                  </label>
                  <div className={"cs-input-wrap" + (error ? " has-error" : "")}>
                    <span className="cs-input-icon">
                      <IconLock />
                    </span>
                    <input
                      id="cs-pass"
                      className="cs-input"
                      type={show ? "text" : "password"}
                      autoComplete="current-password"
                      placeholder="••••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      className="cs-input-action"
                      onClick={() => setShow((s) => !s)}
                      aria-label={show ? "Hide password" : "Show password"}
                    >
                      <IconEye off={show} />
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="cs-help" role="alert">
                    <IconAlert />
                    {error}
                  </div>
                )}

                <div className="cs-options">
                  <label className="cs-check">
                    <input
                      type="checkbox"
                      checked={remember}
                      onChange={(e) => setRemember(e.target.checked)}
                    />
                    <span className="cs-check-box">
                      <IconCheck />
                    </span>
                    Keep me signed in
                  </label>
                </div>
              </div>

              <button
                type="submit"
                className={"cs-primary" + (loading ? " loading" : "")}
                disabled={loading}
              >
                <span className="cs-primary-label">
                  Sign in <IconArrow />
                </span>
                <span className="cs-spinner" aria-hidden="true" />
              </button>
            </form>
          </section>
        </div>
      </main>
    </div>
  );
}
