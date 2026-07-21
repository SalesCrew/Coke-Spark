"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Building2, KeyRound, Loader2, LogOut, ShieldCheck, Users } from "lucide-react";
import { BackendApiError, updateOwnPasswordWithCurrent } from "@/lib/api/backend";

type PopoverMode = "profile" | "password";

type AdminProfilePopoverProps = {
  open: boolean;
  mode: PopoverMode;
  anchorRect: DOMRect | null;
  userId: string | null;
  userName: string;
  userEmail: string;
  onClose: () => void;
  onModeChange: (next: PopoverMode) => void;
  onOpenManager?: () => void;
  onOpenCustomerAccess?: () => void;
  onLogout: () => void;
};

export function AdminProfilePopover({
  open,
  mode,
  anchorRect,
  userId,
  userName,
  userEmail,
  onClose,
  onModeChange,
  onOpenManager,
  onOpenCustomerAccess,
  onLogout,
}: AdminProfilePopoverProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    if (!open) {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setError(null);
      setSuccess(null);
      setIsSubmitting(false);
      setEntered(false);
      return;
    }
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

  useEffect(() => {
    if (mode === "profile") {
      setError(null);
      setSuccess(null);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    }
  }, [mode]);

  const cardLayout = useMemo(() => {
    if (!anchorRect || typeof window === "undefined") {
      return { left: 84, top: 20 };
    }
    const width = 320;
    const left = Math.max(68, Math.min(anchorRect.right + 12, window.innerWidth - width - 16));
    const top = Math.max(12, Math.min(anchorRect.top, window.innerHeight - 320));
    return { left, top };
  }, [anchorRect]);

  const minLength = 8;
  const isPasswordValid = newPassword.length >= minLength;
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;
  const canSubmit = Boolean(userId && currentPassword.length > 0 && isPasswordValid && passwordsMatch && !isSubmitting);
  const profileActionCount = 3 + (onOpenManager ? 1 : 0) + (onOpenCustomerAccess ? 1 : 0);
  const profilePaneHeight = profileActionCount * 34 + Math.max(0, profileActionCount - 1) * 8 + 14;

  const handlePasswordSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit || !userId) return;
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      await updateOwnPasswordWithCurrent({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSuccess("Passwort erfolgreich aktualisiert.");
      window.setTimeout(() => onModeChange("profile"), 900);
    } catch (err) {
      if (err instanceof BackendApiError) {
        setError(err.message || "Passwort konnte nicht aktualisiert werden.");
      } else {
        setError("Passwort konnte nicht aktualisiert werden.");
      }
    } finally {
      setIsSubmitting(false);
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
        zIndex: 1200,
        background: "transparent",
      }}
    >
      <div
        style={{
          position: "fixed",
          left: cardLayout.left,
          top: cardLayout.top,
          width: 320,
          borderRadius: 16,
          border: "1px solid rgba(15,23,42,0.08)",
          background: "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(248,250,252,0.98))",
          boxShadow: "0 14px 30px rgba(15,23,42,0.12), 0 2px 8px rgba(15,23,42,0.08), inset 0 1px 0 rgba(255,255,255,0.8)",
          overflow: "hidden",
          transition: "opacity 180ms ease, transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1)",
          opacity: entered ? 1 : 0,
          transform: entered ? "translateY(0)" : "translateY(8px)",
        }}
      >
        <div style={{ padding: "14px 14px 0" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>{userName || "Admin Nutzer"}</div>
          <div style={{ marginTop: 2, fontSize: 11, color: "rgba(15,23,42,0.58)" }}>{userEmail || "—"}</div>
        </div>

        <div
          style={{
            marginTop: 10,
            overflow: "hidden",
            height: mode === "profile" ? profilePaneHeight : 254,
            transition: "height 240ms cubic-bezier(0.2, 0.8, 0.2, 1)",
          }}
        >
          <div
            style={{
              width: "200%",
              display: "flex",
              transform: mode === "profile" ? "translateX(0%)" : "translateX(-50%)",
              transition: "transform 260ms cubic-bezier(0.2, 0.8, 0.2, 1)",
            }}
          >
            <div style={{ width: "50%", padding: "0 14px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
              <button
                type="button"
                onClick={() => onModeChange("password")}
                style={{
                  height: 34,
                  borderRadius: 10,
                  border: "1px solid rgba(15,23,42,0.1)",
                  background: "linear-gradient(180deg, #ffffff, #f8fafc)",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#0f172a",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 7,
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9), 0 1px 2px rgba(15,23,42,0.06)",
                }}
              >
                <KeyRound size={13} />
                Passwort ändern
              </button>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  window.location.assign("/datenschutz/admin");
                }}
                style={{
                  height: 34,
                  borderRadius: 10,
                  border: "1px solid rgba(15,23,42,0.1)",
                  background: "linear-gradient(180deg, #ffffff, #f8fafc)",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#0f172a",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 7,
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9), 0 1px 2px rgba(15,23,42,0.06)",
                }}
              >
                <ShieldCheck size={13} />
                Datenschutzinformation
              </button>
              <button
                type="button"
                onClick={onLogout}
                style={{
                  height: 34,
                  borderRadius: 10,
                  border: "1px solid rgba(185,28,28,0.16)",
                  background: "linear-gradient(180deg, rgba(254,242,242,0.98), rgba(254,226,226,0.96))",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#b91c1c",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 7,
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.85), 0 1px 2px rgba(185,28,28,0.12)",
                }}
              >
                <LogOut size={13} />
                Logout
              </button>
              {onOpenManager ? <button
                type="button"
                onClick={onOpenManager}
                style={{
                  height: 34,
                  borderRadius: 10,
                  border: "1px solid rgba(15,23,42,0.1)",
                  background: "linear-gradient(180deg, #ffffff, rgba(248,250,252,0.96))",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#0f172a",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 7,
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9), 0 1px 2px rgba(15,23,42,0.06)",
                }}
              >
                <Users size={13} />
                Mitarbeiter verwalten
              </button> : null}
              {onOpenCustomerAccess ? <button
                type="button"
                onClick={onOpenCustomerAccess}
                style={{
                  height: 34,
                  borderRadius: 10,
                  border: "1px solid rgba(15,23,42,0.1)",
                  background: "linear-gradient(180deg, #ffffff, rgba(248,250,252,0.96))",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#0f172a",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 7,
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9), 0 1px 2px rgba(15,23,42,0.06)",
                }}
              >
                <Building2 size={13} />
                Kundenzugang verwalten
              </button> : null}
            </div>

            <div style={{ width: "50%", padding: "0 14px 14px" }}>
              <form onSubmit={handlePasswordSubmit} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => onModeChange("profile")}
                  style={{
                    alignSelf: "flex-start",
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    padding: 0,
                    marginBottom: 2,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    color: "rgba(15,23,42,0.7)",
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                >
                  <ArrowLeft size={12} />
                  Zurück
                </button>

                <input
                  type="password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  placeholder="Aktuelles Passwort"
                  autoComplete="current-password"
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
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder="Neues Passwort"
                  autoComplete="new-password"
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
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Passwort bestätigen"
                  autoComplete="new-password"
                  style={{
                    height: 34,
                    borderRadius: 9,
                    border: "1px solid rgba(15,23,42,0.12)",
                    padding: "0 10px",
                    fontSize: 12,
                    outline: "none",
                  }}
                />

                {!isPasswordValid && newPassword.length > 0 ? (
                  <div style={{ fontSize: 10, color: "#b45309" }}>
                    Passwort muss mindestens {minLength} Zeichen enthalten.
                  </div>
                ) : null}
                {!passwordsMatch && confirmPassword.length > 0 ? (
                  <div style={{ fontSize: 10, color: "#b91c1c" }}>Passwörter stimmen nicht überein.</div>
                ) : null}
                {error ? <div style={{ fontSize: 10, color: "#b91c1c" }}>{error}</div> : null}
                {success ? <div style={{ fontSize: 10, color: "#047857" }}>{success}</div> : null}

                <button
                  type="submit"
                  disabled={!canSubmit}
                  style={{
                    marginTop: 2,
                    height: 34,
                    borderRadius: 9,
                    border: "none",
                    background: "linear-gradient(180deg, #ef4444, #dc2626)",
                    color: "#fff",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: canSubmit ? "pointer" : "not-allowed",
                    opacity: canSubmit ? 1 : 0.58,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.25), 0 4px 10px rgba(220,38,38,0.22)",
                  }}
                >
                  {isSubmitting ? <Loader2 size={13} className="animate-spin" /> : null}
                  Speichern
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
