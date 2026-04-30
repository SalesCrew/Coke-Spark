"use client";

import { useMemo, useState } from "react";
import { Plus_Jakarta_Sans } from "next/font/google";
import { useRouter } from "next/navigation";
import { ArrowRight, Lock, Mail, Settings2, Store, UsersRound } from "lucide-react";
import Aurora from "@/components/ui/Aurora";
import { loginWithBackend, saveAuthSession } from "@/lib/api/backend";

type LoginRole = "gm" | "sm" | "admin" | "coke";

const PRIMARY_ROLES: Array<{ id: LoginRole; label: string }> = [
  { id: "gm", label: "Gebietsmanagement" },
  { id: "sm", label: "Shelf Merchandising" },
];

const HIDDEN_ROLES: Array<{ id: LoginRole; label: string }> = [
  { id: "admin", label: "Admin" },
  { id: "coke", label: "Coke" },
];

const landingFont = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

function shellStyle(): React.CSSProperties {
  return {
    backgroundColor: "rgba(0,0,0,0.035)",
    border: "1px solid rgba(0,0,0,0.05)",
    borderRadius: 20,
    padding: 8,
  };
}

function innerCardStyle(): React.CSSProperties {
  return {
    backgroundColor: "#ffffff",
    border: "1px solid rgba(0,0,0,0.06)",
    borderRadius: 14,
  };
}

function roleButtonStyle(active: boolean): React.CSSProperties {
  if (active) {
    return {
      background: "linear-gradient(to bottom, #DC2626, #e84040)",
      color: "#ffffff",
      border: "1px solid #c42020",
      boxShadow:
        "inset 0 1px 0.6px rgba(255,255,255,0.33), inset 0 -1px 0 rgba(255,255,255,0.15), 0 1px 7px rgba(180,20,20,0.16)",
    };
  }
  return {
    background: "#ffffff",
    color: "#1f2937",
    border: "1px solid rgba(0,0,0,0.08)",
    boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
  };
}

export default function Home() {
  const router = useRouter();

  const [selectedRole, setSelectedRole] = useState<LoginRole>("gm");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [hiddenRolesOpen, setHiddenRolesOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [inlineNotice, setInlineNotice] = useState<string | null>(null);

  const roleLabel = useMemo(() => {
    if (selectedRole === "gm") return "Gebietsmanager Zugang";
    if (selectedRole === "sm") return "Shelf Merchandiser Zugang";
    if (selectedRole === "admin") return "Admin Zugang";
    return "Coke Zugang";
  }, [selectedRole]);

  async function submitLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setInlineNotice(null);
    setSubmitting(true);

    try {
      if (selectedRole === "coke") {
        setInlineNotice("Coke Zugang vorbereitet.");
        return;
      }

      const result = await loginWithBackend({
        email,
        password,
        role: selectedRole,
      });

      saveAuthSession(result);

      if (selectedRole === "gm") {
        router.push("/gm");
        return;
      }
      if (selectedRole === "sm") {
        router.push("/sm");
        return;
      }
      if (selectedRole === "admin") {
        router.push("/admin");
        return;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Login fehlgeschlagen.";
      setInlineNotice(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main
      className={landingFont.className}
      style={{
        minHeight: "100vh",
        backgroundColor: "#f5f5f7",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          height: 500,
          pointerEvents: "none",
          zIndex: 0,
          opacity: 0.38,
        }}
      >
        <Aurora
          colorStops={["#F4B4B4", "#DC2626", "#F4B4B4"]}
          blend={0.6}
          amplitude={0.8}
          speed={0.3}
        />
      </div>

      <div
        className="mx-auto w-full px-4 pb-8 pt-7 md:px-8 md:pb-10 md:pt-10 lg:px-10"
        style={{ maxWidth: 1160, position: "relative", zIndex: 2 }}
      >
        <style>{`
          @media (min-width: 1024px) {
            .landing-top {
              grid-template-columns: minmax(0, 1.2fr) minmax(360px, 0.8fr);
              align-items: stretch;
              gap: 20px;
            }
            .hero-card {
              min-height: 100%;
              display: flex;
              flex-direction: column;
              padding: 28px 30px !important;
            }
            .login-card {
              min-height: 100%;
              display: flex;
              flex-direction: column;
            }
            .login-form {
              flex: 1;
            }
          }
        `}</style>

        <section className="landing-top grid gap-4 lg:mt-1 lg:grid-cols-[1.2fr_0.8fr]">
          <article style={{ ...shellStyle(), boxShadow: "0 14px 40px rgba(0,0,0,0.07)" }}>
            <div
              className="hero-card"
              style={{
                ...innerCardStyle(),
                padding: "20px 20px 18px",
                position: "relative",
                overflow: "hidden",
                border: "1px solid rgba(244,0,9,0.08)",
                background:
                  "radial-gradient(circle at top right, rgba(244,0,9,0.12) 0%, rgba(244,0,9,0.04) 24%, rgba(255,255,255,0) 46%), radial-gradient(circle at bottom left, rgba(244,180,180,0.18) 0%, rgba(255,255,255,0) 42%), linear-gradient(180deg, #ffffff 0%, #fcfbfb 100%)",
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "rgba(167,24,24,0.68)",
                  display: "inline-flex",
                  alignItems: "center",
                  width: "fit-content",
                  padding: "6px 9px",
                  borderRadius: 999,
                  border: "1px solid rgba(244,0,9,0.10)",
                  background: "rgba(244,0,9,0.045)",
                }}
              >
                <button
                  type="button"
                  onClick={() => setHiddenRolesOpen((v) => !v)}
                  aria-label="Versteckte Logins anzeigen"
                  style={{
                    border: "none",
                    background: "transparent",
                    font: "inherit",
                    color: "inherit",
                    margin: 0,
                    padding: 0,
                    cursor: "pointer",
                    textShadow: hiddenRolesOpen ? "0 0 14px rgba(220,38,38,0.28)" : "none",
                    transition: "text-shadow 0.2s ease",
                  }}
                >
                  O
                </button>
                perational Access
              </p>
              <h1
                style={{
                  margin: "12px 0 0",
                  fontSize: "clamp(32px, 5vw, 56px)",
                  lineHeight: 0.96,
                  letterSpacing: "-0.04em",
                  color: "#111827",
                  fontWeight: 800,
                  maxWidth: 700,
                }}
              >
                Ein klarer Einstieg
                <br />
                in deinen Arbeitstag.
              </h1>
              <p
                style={{
                  margin: "14px 0 0",
                  maxWidth: 600,
                  fontSize: "clamp(13px, 2.3vw, 15px)",
                  lineHeight: 1.46,
                  color: "rgba(0,0,0,0.58)",
                  fontWeight: 500,
                }}
              >
                Bereich wählen, anmelden und direkt loslegen. Die Oberfläche bleibt ruhig,
                damit dein Fokus bei Besuchen, Planung und Qualität bleibt.
              </p>
              <p
                style={{
                  margin: "10px 0 0",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "rgba(0,0,0,0.5)",
                }}
              >
                Fuer Shelf Merchandising, Gebietsmanagement und Administration.
              </p>

              <div
                style={{
                  marginTop: "auto",
                  paddingTop: 16,
                  display: "grid",
                  gap: 8,
                  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                }}
              >
                {[
                  {
                    title: "Tagesstart",
                    text: "Anmeldung in Sekunden und klarer Rollenfokus.",
                    tint: "rgba(244,0,9,0.05)",
                    edge: "rgba(244,0,9,0.11)",
                    dot: "#ef4444",
                  },
                  {
                    title: "Feldarbeit",
                    text: "Besuche, Aufgaben und Dokumentation ohne Umwege.",
                    tint: "rgba(220,38,38,0.035)",
                    edge: "rgba(220,38,38,0.10)",
                    dot: "#f87171",
                  },
                  {
                    title: "Steuerung",
                    text: "Standards, Kampagnen und Qualität zentral im Blick.",
                    tint: "rgba(251,191,36,0.08)",
                    edge: "rgba(234,179,8,0.14)",
                    dot: "#f59e0b",
                  },
                ].map((item) => (
                  <div
                    key={item.title}
                    style={{
                      borderRadius: 10,
                      border: `1px solid ${item.edge}`,
                      background: `linear-gradient(140deg, ${item.tint} 0%, rgba(255,255,255,0.96) 72%)`,
                      padding: "10px 11px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        fontSize: 10,
                        letterSpacing: "0.07em",
                        textTransform: "uppercase",
                        color: "rgba(0,0,0,0.42)",
                        fontWeight: 700,
                      }}
                    >
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: 999,
                          backgroundColor: item.dot,
                          boxShadow: `0 0 0 3px ${item.tint}`,
                          flexShrink: 0,
                        }}
                      />
                      {item.title}
                    </div>
                    <p style={{ margin: "6px 0 0", fontSize: 12, color: "rgba(0,0,0,0.66)", lineHeight: 1.4 }}>
                      {item.text}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </article>

          <article style={{ ...shellStyle(), boxShadow: "0 14px 38px rgba(0,0,0,0.08)" }}>
            <div
              className="login-card"
              style={{
                ...innerCardStyle(),
                padding: 18,
                gap: 14,
                background: "linear-gradient(180deg, #ffffff 0%, #fbfbfb 100%)",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: "rgba(0,0,0,0.4)",
                    }}
                  >
                    Zugang
                  </p>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 18,
                      lineHeight: 1.05,
                      letterSpacing: "-0.03em",
                      color: "#111827",
                      fontWeight: 800,
                    }}
                  >
                    Rolle wählen und anmelden
                  </p>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 6,
                    padding: 4,
                    borderRadius: 12,
                    border: "1px solid rgba(0,0,0,0.06)",
                    background: "rgba(0,0,0,0.025)",
                  }}
                >
                  {PRIMARY_ROLES.map((role) => {
                    const active = selectedRole === role.id;
                    return (
                      <button
                        key={role.id}
                        type="button"
                        onClick={() => {
                          setSelectedRole(role.id);
                          setInlineNotice(null);
                        }}
                        style={{
                          minHeight: 42,
                          borderRadius: 10,
                          cursor: "pointer",
                          textAlign: "left",
                          padding: "10px 12px",
                          transition: "all 0.2s ease",
                          ...roleButtonStyle(active),
                        }}
                      >
                        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "-0.01em" }}>{role.label}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <form
                onSubmit={submitLogin}
                className="login-form"
                style={{ display: "flex", flexDirection: "column", flex: 1, marginTop: 2 }}
              >
                <div
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    gap: 12,
                  }}
                >
                  <div
                    style={{
                      padding: "11px 12px",
                      borderRadius: 12,
                      border: "1px solid rgba(0,0,0,0.06)",
                      background:
                        "linear-gradient(180deg, rgba(0,0,0,0.02) 0%, rgba(0,0,0,0.03) 100%)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: "0.07em",
                        textTransform: "uppercase",
                        color: "rgba(0,0,0,0.42)",
                      }}
                    >
                      Aktiver Bereich
                    </div>
                    <div
                      style={{
                        marginTop: 6,
                        fontSize: 13,
                        color: "#111827",
                        fontWeight: 700,
                        letterSpacing: "-0.01em",
                      }}
                    >
                      {roleLabel}
                    </div>
                  </div>

                  <div
                    style={{
                      maxHeight: hiddenRolesOpen ? 72 : 0,
                      opacity: hiddenRolesOpen ? 1 : 0,
                      overflow: "hidden",
                      transition: "max-height 0.25s ease, opacity 0.2s ease",
                      display: "flex",
                      gap: 8,
                      flexWrap: "wrap",
                    }}
                  >
                    {HIDDEN_ROLES.map((role) => {
                      const active = selectedRole === role.id;
                      return (
                        <button
                          key={role.id}
                          type="button"
                          onClick={() => {
                            setSelectedRole(role.id);
                            setInlineNotice(null);
                          }}
                          style={{
                            padding: "6px 10px",
                            borderRadius: 8,
                            border: active ? "1px solid rgba(220,38,38,0.32)" : "1px solid rgba(0,0,0,0.08)",
                            background: active ? "rgba(220,38,38,0.06)" : "#fff",
                            color: active ? "#b91c1c" : "rgba(0,0,0,0.52)",
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          {role.label}
                        </button>
                      );
                    })}
                  </div>

                  <div
                    style={{
                      borderRadius: 14,
                      border: "1px solid rgba(0,0,0,0.06)",
                      background: "rgba(0,0,0,0.018)",
                      padding: 10,
                      display: "grid",
                      gap: 10,
                    }}
                  >
                    {inlineNotice ? (
                      <div
                        style={{
                          fontSize: 11,
                          color: "#b91c1c",
                          fontWeight: 700,
                          textAlign: "left",
                          padding: "0 2px",
                        }}
                      >
                        {inlineNotice}
                      </div>
                    ) : null}

                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        minHeight: 44,
                        padding: "0 12px",
                        borderRadius: 10,
                        border: "1px solid rgba(0,0,0,0.07)",
                        backgroundColor: "#ffffff",
                        boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
                      }}
                    >
                      <Mail size={13} color="rgba(0,0,0,0.32)" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="E-Mail"
                        style={{
                          width: "100%",
                          border: "none",
                          outline: "none",
                          backgroundColor: "transparent",
                          fontSize: 12,
                          color: "#1f2937",
                        }}
                      />
                    </label>

                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        minHeight: 44,
                        padding: "0 12px",
                        borderRadius: 10,
                        border: "1px solid rgba(0,0,0,0.07)",
                        backgroundColor: "#ffffff",
                        boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
                      }}
                    >
                      <Lock size={13} color="rgba(0,0,0,0.32)" />
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Passwort"
                        style={{
                          width: "100%",
                          border: "none",
                          outline: "none",
                          backgroundColor: "transparent",
                          fontSize: 12,
                          color: "#1f2937",
                        }}
                      />
                    </label>
                  </div>
                </div>

                <div style={{ display: "grid", gap: 8, paddingTop: 12 }}>
                  <button
                    type="submit"
                    disabled={submitting}
                    style={{
                      width: "100%",
                      height: 38,
                      borderRadius: 10,
                      border: "none",
                      cursor: submitting ? "not-allowed" : "pointer",
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: "0.02em",
                      color: "#ffffff",
                      background: submitting
                        ? "linear-gradient(to bottom, #ef9a9a, #f08a8a)"
                        : "linear-gradient(to bottom, #DC2626, #e84040)",
                      boxShadow: submitting
                        ? "none"
                        : "inset 0 1px 0.6px rgba(255,255,255,0.33), inset 0 -1px 0 rgba(255,255,255,0.15), 0 0 0 1px #c42020, 0 1px 6px rgba(180,20,20,0.14)",
                      transition: "all 0.16s ease",
                    }}
                  >
                    {submitting ? "Einloggen..." : "Einloggen"}
                  </button>
                </div>
              </form>
            </div>
          </article>
        </section>

        <section className="mt-4 lg:mt-5" style={{ ...shellStyle(), boxShadow: "0 10px 30px rgba(0,0,0,0.05)" }}>
          <div style={{ ...innerCardStyle(), padding: "12px 12px 10px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                marginBottom: 10,
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: 11,
                  letterSpacing: "0.07em",
                  textTransform: "uppercase",
                  color: "rgba(0,0,0,0.42)",
                  fontWeight: 700,
                }}
              >
                Zugangsbereiche
              </p>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 11,
                  color: "rgba(0,0,0,0.47)",
                  fontWeight: 600,
                }}
              >
                Bereich wählen und starten
                <ArrowRight size={12} />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  icon: UsersRound,
                  title: "Shelf Merchandising",
                  text: "Shelf Merchandising im laufenden Tag: Planung, Platzierung und saubere Umsetzung.",
                },
                {
                  icon: Store,
                  title: "Gebietsmanagement",
                  text: "Marktbesuche, Umsetzung und saubere Dokumentation direkt im Feld.",
                },
                {
                  icon: Settings2,
                  title: "Administration",
                  text: "Standards, Kampagnen und operative Qualität zentral steuern.",
                },
              ].map((item) => (
                <article
                  key={item.title}
                  style={{
                    borderRadius: 10,
                    border: "1px solid rgba(0,0,0,0.07)",
                    backgroundColor: "#ffffff",
                    padding: "10px 11px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#111827" }}>{item.title}</p>
                    <item.icon size={13} color="rgba(220,38,38,0.75)" />
                  </div>
                  <p style={{ margin: "6px 0 0", fontSize: 11, color: "rgba(0,0,0,0.56)", lineHeight: 1.42 }}>
                    {item.text}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
