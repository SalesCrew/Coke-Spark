"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, FileCheck2, Loader2, LogOut, ShieldCheck } from "lucide-react";
import {
  acceptCurrentEmployeeAgreement,
  fetchCurrentEmployeeAgreement,
  logoutCurrentUser,
  type EmployeeAgreementPayload,
} from "@/lib/api/backend";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { SmEmployeeAgreement } from "@/components/sm/SmEmployeeAgreement";

function readSafeNextPath(fallback: "/gm" | "/sm"): string {
  if (typeof window === "undefined") return fallback;
  const params = new URLSearchParams(window.location.search);
  const candidate = params.get("next") || "";
  if (candidate.startsWith("/gm") || candidate.startsWith("/sm")) return candidate;
  return fallback;
}

export default function EmployeeAgreementPage() {
  const router = useRouter();
  const { session, status } = useAuthGuard(["gm", "sm"]);
  const [payload, setPayload] = useState<EmployeeAgreementPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextPath, setNextPath] = useState("/gm");
  const [autoContinueWhenAccepted, setAutoContinueWhenAccepted] = useState(false);
  const [smRetryKey, setSmRetryKey] = useState(0);

  useEffect(() => {
    if (status !== "authorized") return;
    const fallback = session?.user.role === "sm" ? "/sm" : "/gm";
    if (typeof window !== "undefined") {
      setAutoContinueWhenAccepted(new URLSearchParams(window.location.search).has("next"));
    }
    setNextPath(readSafeNextPath(fallback));
  }, [session?.user.role, status]);

  useEffect(() => {
    if (status !== "authorized") return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchCurrentEmployeeAgreement()
      .then((data) => {
        if (cancelled) return;
        setPayload(data);
        if (data.accepted) {
          setChecked(true);
        }
        if (data.accepted && autoContinueWhenAccepted) {
          router.replace(nextPath);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Vereinbarung konnte nicht geladen werden.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [autoContinueWhenAccepted, nextPath, router, status, smRetryKey]);

  const fullName = useMemo(() => {
    const first = session?.user.firstName?.trim() ?? "";
    const last = session?.user.lastName?.trim() ?? "";
    return `${first} ${last}`.trim() || session?.user.email || "Field Force";
  }, [session]);

  const handleAccept = async () => {
    if (!payload || !checked || submitting) return;
    if (payload.accepted) {
      router.replace(nextPath);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await acceptCurrentEmployeeAgreement(payload.agreement.version);
      router.replace(nextPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Vereinbarung konnte nicht gespeichert werden.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = () => {
    logoutCurrentUser();
    router.replace("/");
  };

  const isBusy = status !== "authorized" || loading;

  if (session?.user.role === "sm") {
    return <SmEmployeeAgreement payload={payload} fullName={fullName} loading={isBusy} submitting={submitting} checked={checked} error={error} onChecked={setChecked} onAccept={() => void handleAccept()} onLogout={handleLogout} onRetry={() => setSmRetryKey((value) => value + 1)} />;
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "radial-gradient(circle at 18% 0%, rgba(239,68,68,0.18), transparent 34%), #f5f5f7",
        color: "#111827",
        fontFamily: "var(--font-inter), Inter, system-ui, sans-serif",
        padding: "34px 18px",
      }}
    >
      <section style={{ maxWidth: 880, margin: "0 auto" }}>
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(220,38,38,0.72)", marginBottom: 8 }}>
              Mitarbeitervereinbarung
            </div>
            <h1 style={{ margin: 0, fontSize: 34, lineHeight: 1.02, letterSpacing: "-0.04em", fontWeight: 820 }}>
              Coke Spark nutzen
            </h1>
            <p style={{ margin: "10px 0 0", maxWidth: 620, fontSize: 13, lineHeight: 1.65, color: "rgba(17,24,39,0.58)", fontWeight: 560 }}>
              Bevor du die App verwendest, musst du die aktuelle Nutzungs- und Kontrollmaßnahmenvereinbarung bestätigen.
            </p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            style={{
              height: 36,
              border: "1px solid rgba(220,38,38,0.18)",
              borderRadius: 12,
              background: "#fff",
              color: "#dc2626",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: "0 12px",
              fontSize: 12,
              fontWeight: 760,
              fontFamily: "inherit",
              cursor: "pointer",
              boxShadow: "0 1px 4px rgba(15,23,42,0.06), inset 0 1px 0 rgba(255,255,255,0.9)",
            }}
          >
            <LogOut size={14} strokeWidth={2} />
            Logout
          </button>
        </header>

        <div
          style={{
            border: "1px solid rgba(15,23,42,0.08)",
            borderRadius: 24,
            background: "#fff",
            boxShadow: "0 22px 60px rgba(15,23,42,0.12)",
            overflow: "hidden",
          }}
        >
          <div style={{ padding: "22px 24px", borderBottom: "1px solid rgba(15,23,42,0.08)", display: "grid", gridTemplateColumns: "1fr auto", gap: 16, alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 16,
                  background: "linear-gradient(180deg, rgba(220,38,38,0.12), rgba(220,38,38,0.04))",
                  border: "1px solid rgba(220,38,38,0.16)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#dc2626",
                }}
              >
                <FileCheck2 size={19} strokeWidth={2} />
              </div>
              <div style={{ minWidth: 0 }}>
                <h2 style={{ margin: 0, fontSize: 18, lineHeight: 1.15, fontWeight: 840, letterSpacing: "-0.02em" }}>
                  {payload?.agreement.title ?? "Nutzungs- und Kontrollmaßnahmenvereinbarung"}
                </h2>
                <p style={{ margin: "5px 0 0", fontSize: 12, color: "rgba(17,24,39,0.52)", fontWeight: 620 }}>
                  {fullName} {payload ? `· Version ${payload.agreement.version}` : ""}
                </p>
              </div>
            </div>
            <span
              style={{
                height: 30,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "0 10px",
                borderRadius: 999,
                background: "rgba(16,185,129,0.08)",
                color: "#059669",
                fontSize: 11,
                fontWeight: 800,
                whiteSpace: "nowrap",
              }}
            >
              <ShieldCheck size={13} strokeWidth={2} />
              Pflicht vor Nutzung
            </span>
          </div>

          {isBusy ? (
            <div style={{ minHeight: 360, display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(17,24,39,0.46)", gap: 10, fontSize: 13, fontWeight: 700 }}>
              <Loader2 size={18} className="animate-spin" />
              Vereinbarung wird geladen...
            </div>
          ) : (
            <>
              <div style={{ maxHeight: "58vh", overflowY: "auto", padding: "20px 24px 6px", display: "grid", gap: 12 }}>
                {payload?.agreement.sections.map((section) => (
                  <section
                    key={section.title}
                    style={{
                      border: "1px solid rgba(15,23,42,0.07)",
                      borderRadius: 16,
                      background: "linear-gradient(180deg, #fff, rgba(248,250,252,0.8))",
                      padding: "15px 16px",
                    }}
                  >
                    <h3 style={{ margin: 0, fontSize: 13, lineHeight: 1.25, letterSpacing: "-0.01em", fontWeight: 840 }}>
                      {section.title}
                    </h3>
                    <div style={{ marginTop: 9, display: "grid", gap: 7 }}>
                      {section.body.map((paragraph) => (
                        <p key={paragraph} style={{ margin: 0, fontSize: 12.5, lineHeight: 1.68, color: "rgba(17,24,39,0.64)", fontWeight: 540 }}>
                          {paragraph}
                        </p>
                      ))}
                    </div>
                  </section>
                ))}
              </div>

              <div style={{ padding: 24, borderTop: "1px solid rgba(15,23,42,0.08)", background: "rgba(248,250,252,0.66)" }}>
                {error ? (
                  <div style={{ marginBottom: 12, border: "1px solid rgba(220,38,38,0.18)", background: "rgba(254,242,242,0.92)", color: "#dc2626", borderRadius: 14, padding: "11px 12px", fontSize: 12, fontWeight: 720 }}>
                    {error}
                  </div>
                ) : null}

                <label
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                    padding: 14,
                    borderRadius: 16,
                    background: "#fff",
                    border: checked ? "1px solid rgba(16,185,129,0.26)" : "1px solid rgba(15,23,42,0.08)",
                    boxShadow: "0 1px 4px rgba(15,23,42,0.04)",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={payload?.accepted}
                    onChange={(event) => setChecked(event.target.checked)}
                    style={{ marginTop: 2, width: 16, height: 16, accentColor: "#dc2626" }}
                  />
                  <span style={{ fontSize: 12.5, lineHeight: 1.55, color: "rgba(17,24,39,0.68)", fontWeight: 610 }}>
                    {payload?.accepted
                      ? `Diese Version wurde bereits am ${new Date(payload.acceptance?.acceptedAt ?? "").toLocaleString("de-AT", { dateStyle: "medium", timeStyle: "short" })} akzeptiert.`
                      : "Ich habe die Vereinbarung gelesen und akzeptiere die Nutzung von Coke Spark als Arbeits-, Reporting- und Kontrollsystem im beschriebenen Umfang."}
                  </span>
                </label>

                <div style={{ marginTop: 16, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <Link href="/datenschutz/gm" style={{ fontSize: 12, fontWeight: 760, color: "rgba(17,24,39,0.52)", textDecoration: "none" }}>
                    Datenschutzinformation öffnen
                  </Link>
                  <button
                    type="button"
                    disabled={(!checked && !payload?.accepted) || submitting || !payload}
                    onClick={handleAccept}
                    style={{
                      height: 42,
                      minWidth: 210,
                      border: "1px solid rgba(153,27,27,0.24)",
                      borderRadius: 13,
                      background: (!checked && !payload?.accepted) || submitting || !payload ? "rgba(15,23,42,0.08)" : "linear-gradient(180deg, #ff3b3b, #d71920)",
                      color: (!checked && !payload?.accepted) || submitting || !payload ? "rgba(17,24,39,0.38)" : "#fff",
                      fontSize: 12,
                      fontWeight: 850,
                      fontFamily: "inherit",
                      cursor: (!checked && !payload?.accepted) || submitting || !payload ? "not-allowed" : "pointer",
                      boxShadow: (!checked && !payload?.accepted) || submitting || !payload ? "none" : "0 8px 18px rgba(220,38,38,0.22), inset 0 1px 0 rgba(255,255,255,0.36)",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                    }}
                  >
                    {submitting ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} strokeWidth={2.2} />}
                    {payload?.accepted ? "Zurück zur App" : "Akzeptieren und fortfahren"}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
