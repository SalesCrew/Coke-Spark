"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Check, Copy, Loader2, Plus, ShieldCheck, UserX, X } from "lucide-react";
import {
  BackendApiError,
  createAdminUser,
  deactivateAdminUser,
  fetchAdminUsers,
  type AdminUserRecord,
} from "@/lib/api/backend";

type AdminManagerPanelProps = {
  open: boolean;
  anchorRect: DOMRect | null;
  currentUserId: string | null;
  onClose: () => void;
};

const ADMIN_CARD_ROW_ESTIMATE = 100;
const ADMIN_LIST_VISIBLE_ROWS = 3;
const ADMIN_LIST_GAP = 10;
const ADMIN_LIST_VIEWPORT_HEIGHT =
  ADMIN_CARD_ROW_ESTIMATE * ADMIN_LIST_VISIBLE_ROWS + ADMIN_LIST_GAP * (ADMIN_LIST_VISIBLE_ROWS - 1);

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unbekannt";
  return date.toLocaleDateString("de-AT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function AdminManagerPanel({ open, anchorRect, currentUserId, onClose }: AdminManagerPanelProps) {
  const [admins, setAdmins] = useState<AdminUserRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [deactivateTargetId, setDeactivateTargetId] = useState<string | null>(null);
  const [confirmDeactivateId, setConfirmDeactivateId] = useState<string | null>(null);
  const [confirmDeactivateText, setConfirmDeactivateText] = useState("");
  const [oneTimePassword, setOneTimePassword] = useState<string | null>(null);
  const [passwordCopied, setPasswordCopied] = useState(false);
  const [entered, setEntered] = useState(false);

  const loadAdmins = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const rows = await fetchAdminUsers();
      setAdmins(rows);
    } catch (err) {
      if (err instanceof BackendApiError) {
        setError(err.message || "Admins konnten nicht geladen werden.");
      } else {
        setError("Admins konnten nicht geladen werden.");
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void loadAdmins();
  }, [open, loadAdmins]);

  useEffect(() => {
    if (!open) {
      setConfirmDeactivateId(null);
      setConfirmDeactivateText("");
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setEntered(false);
    const animationFrame = window.requestAnimationFrame(() => setEntered(true));
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(animationFrame);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  const panelLayout = useMemo(() => {
    if (!anchorRect || typeof window === "undefined") {
      return { left: 86, top: 16, maxHeight: "calc(100vh - 32px)" };
    }
    const width = 560;
    const left = Math.max(72, Math.min(anchorRect.right + 16, window.innerWidth - width - 16));
    const top = Math.max(12, Math.min(anchorRect.top - 12, window.innerHeight - 360));
    const heightPx = Math.max(300, window.innerHeight - top - 16);
    return { left, top, maxHeight: `${heightPx}px` };
  }, [anchorRect]);

  const sortedAdmins = useMemo(() => {
    return [...admins].sort((a, b) => {
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
      return b.createdAt.localeCompare(a.createdAt);
    });
  }, [admins]);

  const canCreate = firstName.trim().length > 0 && lastName.trim().length > 0 && email.trim().length > 0;
  const canConfirmDeactivation = confirmDeactivateText.trim() === "Deaktivieren";

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canCreate || isCreating) return;
    setIsCreating(true);
    setError(null);
    try {
      const created = await createAdminUser({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
      });
      setAdmins((prev) => [created.user, ...prev.filter((entry) => entry.id !== created.user.id)]);
      setOneTimePassword(created.oneTimePassword);
      setPasswordCopied(false);
      setFirstName("");
      setLastName("");
      setEmail("");
    } catch (err) {
      if (err instanceof BackendApiError) {
        setError(err.message || "Admin konnte nicht erstellt werden.");
      } else {
        setError("Admin konnte nicht erstellt werden.");
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeactivate = async (userId: string) => {
    if (!userId || deactivateTargetId || !canConfirmDeactivation) return;
    setDeactivateTargetId(userId);
    setError(null);
    try {
      await deactivateAdminUser(userId);
      setAdmins((prev) =>
        prev.map((entry) =>
          entry.id === userId
            ? {
                ...entry,
                isActive: false,
                deletedAt: entry.deletedAt ?? new Date().toISOString(),
              }
            : entry,
        ),
      );
      setConfirmDeactivateId(null);
      setConfirmDeactivateText("");
    } catch (err) {
      if (err instanceof BackendApiError) {
        setError(err.message || "Admin konnte nicht deaktiviert werden.");
      } else {
        setError("Admin konnte nicht deaktiviert werden.");
      }
    } finally {
      setDeactivateTargetId(null);
    }
  };

  const handleStartDeactivateConfirm = (userId: string) => {
    if (!userId) return;
    setConfirmDeactivateId(userId);
    setConfirmDeactivateText("");
    setError(null);
  };

  const handleCopyPassword = async () => {
    if (!oneTimePassword || typeof navigator === "undefined" || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(oneTimePassword);
      setPasswordCopied(true);
      window.setTimeout(() => setPasswordCopied(false), 1600);
    } catch {
      setPasswordCopied(false);
    }
  };

  if (!open || typeof document === "undefined") return null;

  return (
    <div
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1300,
        background: "transparent",
      }}
    >
      <div
        style={{
          position: "fixed",
          left: panelLayout.left,
          top: panelLayout.top,
          width: "min(560px, calc(100vw - 32px))",
          maxHeight: panelLayout.maxHeight,
          overflow: "hidden",
          borderRadius: 18,
          border: "1px solid rgba(15,23,42,0.08)",
          background: "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(248,250,252,0.96))",
          boxShadow: "0 16px 34px rgba(15,23,42,0.14), 0 3px 10px rgba(15,23,42,0.08), inset 0 1px 0 rgba(255,255,255,0.86)",
          display: "flex",
          flexDirection: "column",
          transform: entered ? "translateX(0)" : "translateX(-12px)",
          transition: "transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity 180ms ease",
          opacity: entered ? 1 : 0,
        }}
      >
        <div
          style={{
            padding: "14px 16px",
            borderBottom: "1px solid rgba(15,23,42,0.06)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <ShieldCheck size={16} color="#0f172a" />
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>Mitarbeiter verwalten</div>
              <div style={{ fontSize: 11, color: "rgba(15,23,42,0.56)" }}>Admin Accounts</div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: 30,
              height: 30,
              borderRadius: 9,
              border: "1px solid rgba(15,23,42,0.08)",
              background: "linear-gradient(180deg, #ffffff, #f8fafc)",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              color: "rgba(15,23,42,0.62)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9), 0 1px 2px rgba(15,23,42,0.08)",
            }}
          >
            <X size={14} />
          </button>
        </div>

        <style>{`
          .admin-manager-scroll {
            -ms-overflow-style: none;
            scrollbar-width: none;
          }
          .admin-manager-scroll::-webkit-scrollbar {
            display: none;
            width: 0;
            height: 0;
          }
        `}</style>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 248px", gap: 0, minHeight: 292 }}>
          <div style={{ padding: 16, borderRight: "1px solid rgba(15,23,42,0.06)", overflow: "hidden" }}>
            {isLoading ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: "rgba(15,23,42,0.6)", fontSize: 12 }}>
                <Loader2 size={14} className="animate-spin" />
                Admins werden geladen...
              </div>
            ) : sortedAdmins.length === 0 ? (
              <div style={{ fontSize: 12, color: "rgba(15,23,42,0.55)" }}>Keine Admin-Konten gefunden.</div>
            ) : (
              <div
                className="admin-manager-scroll"
                style={{
                  maxHeight: ADMIN_LIST_VIEWPORT_HEIGHT,
                  overflowY: "auto",
                  paddingRight: 4,
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: ADMIN_LIST_GAP }}>
                  {sortedAdmins.map((admin) => {
                    const isSelf = admin.id === currentUserId;
                    const isDeactivating = deactivateTargetId === admin.id;
                    const isConfirmingDeactivate = confirmDeactivateId === admin.id;
                    return (
                      <div
                        key={admin.id}
                        style={{
                          borderRadius: 12,
                          border: "1px solid rgba(15,23,42,0.08)",
                          padding: 12,
                          background: admin.isActive ? "#ffffff" : "rgba(248,250,252,0.9)",
                          opacity: admin.isActive ? 1 : 0.72,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>
                              {admin.firstName} {admin.lastName}
                            </div>
                            <div style={{ fontSize: 11, color: "rgba(15,23,42,0.58)" }}>{admin.email}</div>
                          </div>
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 600,
                              padding: "3px 8px",
                              borderRadius: 999,
                              background: admin.isActive ? "rgba(5,150,105,0.14)" : "rgba(100,116,139,0.18)",
                              color: admin.isActive ? "#047857" : "#475569",
                            }}
                          >
                            {admin.isActive ? "Aktiv" : "Inaktiv"}
                          </span>
                        </div>
                        <div
                          style={{
                            marginTop: 10,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 8,
                            fontSize: 10,
                            color: "rgba(15,23,42,0.52)",
                          }}
                        >
                          <span>Erstellt: {formatDate(admin.createdAt)}</span>
                          {isSelf ? (
                            <span style={{ fontWeight: 600 }}>Eigener Account</span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleStartDeactivateConfirm(admin.id)}
                              disabled={!admin.isActive || isDeactivating}
                              style={{
                                border: "none",
                                background: "transparent",
                                color: admin.isActive ? "#b91c1c" : "rgba(100,116,139,0.65)",
                                fontSize: 10,
                                fontWeight: 700,
                                cursor: !admin.isActive ? "default" : "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                              }}
                            >
                              {isDeactivating ? <Loader2 size={11} className="animate-spin" /> : <UserX size={11} />}
                              Deaktivieren
                            </button>
                          )}
                        </div>
                        {!isSelf && admin.isActive && isConfirmingDeactivate ? (
                          <div
                            style={{
                              marginTop: 10,
                              borderRadius: 10,
                              border: "1px dashed rgba(185,28,28,0.45)",
                              background: "rgba(254,242,242,0.86)",
                              padding: 10,
                              display: "flex",
                              flexDirection: "column",
                              gap: 8,
                            }}
                          >
                            <div style={{ fontSize: 10, fontWeight: 600, color: "#7f1d1d" }}>
                              Zum Bestätigen bitte exakt <strong>Deaktivieren</strong> eingeben.
                            </div>
                            <input
                              value={confirmDeactivateText}
                              onChange={(event) => setConfirmDeactivateText(event.target.value)}
                              placeholder="Deaktivieren"
                              style={{
                                height: 30,
                                borderRadius: 8,
                                border: "1px solid rgba(185,28,28,0.35)",
                                background: "#fff",
                                padding: "0 8px",
                                fontSize: 11,
                                color: "#7f1d1d",
                                outline: "none",
                              }}
                            />
                            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                              <button
                                type="button"
                                onClick={() => {
                                  setConfirmDeactivateId(null);
                                  setConfirmDeactivateText("");
                                }}
                                style={{
                                  height: 28,
                                  borderRadius: 8,
                                  border: "1px solid rgba(15,23,42,0.12)",
                                  background: "#fff",
                                  color: "#334155",
                                  fontSize: 10,
                                  fontWeight: 700,
                                  cursor: "pointer",
                                  padding: "0 10px",
                                }}
                              >
                                Abbrechen
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleDeactivate(admin.id)}
                                disabled={!canConfirmDeactivation || isDeactivating}
                                style={{
                                  height: 28,
                                  borderRadius: 8,
                                  border: "none",
                                  background: "linear-gradient(180deg, #dc2626, #b91c1c)",
                                  color: "#fff",
                                  fontSize: 10,
                                  fontWeight: 700,
                                  cursor: canConfirmDeactivation && !isDeactivating ? "pointer" : "not-allowed",
                                  opacity: canConfirmDeactivation && !isDeactivating ? 1 : 0.58,
                                  padding: "0 10px",
                                }}
                              >
                                Endgültig deaktivieren
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>Neuen Admin erstellen</div>
              <div style={{ fontSize: 11, color: "rgba(15,23,42,0.56)", marginTop: 2 }}>
                Rolle ist in diesem Schritt fix auf Admin.
              </div>
            </div>

            <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <input
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                placeholder="Vorname"
                autoComplete="given-name"
                style={{
                  height: 34,
                  borderRadius: 9,
                  border: "1px solid rgba(15,23,42,0.12)",
                  padding: "0 10px",
                  fontSize: 12,
                  outline: "none",
                }}
              />
              <input
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                placeholder="Nachname"
                autoComplete="family-name"
                style={{
                  height: 34,
                  borderRadius: 9,
                  border: "1px solid rgba(15,23,42,0.12)",
                  padding: "0 10px",
                  fontSize: 12,
                  outline: "none",
                }}
              />
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="E-Mail"
                autoComplete="email"
                style={{
                  height: 34,
                  borderRadius: 9,
                  border: "1px solid rgba(15,23,42,0.12)",
                  padding: "0 10px",
                  fontSize: 12,
                  outline: "none",
                }}
              />
              <button
                type="submit"
                disabled={!canCreate || isCreating}
                style={{
                  marginTop: 4,
                  height: 34,
                  borderRadius: 9,
                  border: "none",
                  background: "linear-gradient(180deg, #ef4444, #dc2626)",
                  color: "#fff",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: canCreate && !isCreating ? "pointer" : "not-allowed",
                  opacity: canCreate && !isCreating ? 1 : 0.58,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.24), 0 4px 10px rgba(220,38,38,0.22)",
                }}
              >
                {isCreating ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                Admin erstellen
              </button>
            </form>

            <div
              style={{
                borderRadius: 10,
                border: "1px solid rgba(15,23,42,0.08)",
                background: "linear-gradient(180deg, #ffffff, #f8fafc)",
                padding: 10,
                fontSize: 10,
                lineHeight: 1.45,
                color: "rgba(15,23,42,0.62)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9)",
              }}
            >
              Nach dem Erstellen erhältst du ein einmaliges Start-Passwort zum Kopieren.
            </div>

            {oneTimePassword ? (
              <div
                style={{
                  borderRadius: 10,
                  border: "1px dashed rgba(15,23,42,0.2)",
                  background: "rgba(248,250,252,0.9)",
                  padding: 10,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                <div style={{ fontSize: 10, fontWeight: 700, color: "#0f172a" }}>Einmal-Passwort</div>
                <code
                  style={{
                    display: "block",
                    fontSize: 12,
                    fontWeight: 600,
                    letterSpacing: "0.02em",
                    color: "#0f172a",
                    wordBreak: "break-all",
                  }}
                >
                  {oneTimePassword}
                </code>
                <button
                  type="button"
                  onClick={() => void handleCopyPassword()}
                  style={{
                    height: 30,
                    borderRadius: 8,
                    border: "1px solid rgba(15,23,42,0.1)",
                    background: "linear-gradient(180deg, #ffffff, #f8fafc)",
                    cursor: "pointer",
                    fontSize: 11,
                    fontWeight: 600,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    color: "#0f172a",
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9), 0 1px 2px rgba(15,23,42,0.08)",
                  }}
                >
                  {passwordCopied ? <Check size={12} /> : <Copy size={12} />}
                  {passwordCopied ? "Kopiert" : "Passwort kopieren"}
                </button>
              </div>
            ) : null}

            {error ? <div style={{ fontSize: 11, color: "#b91c1c" }}>{error}</div> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
