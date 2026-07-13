"use client";

import { type CSSProperties, type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  Camera,
  Check,
  Eye,
  EyeOff,
  FileCheck2,
  ImagePlus,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Store,
  Trophy,
  User,
} from "lucide-react";
import Aurora from "@/components/ui/Aurora";
import { CollapsibleMenu } from "@/components/ui/CollapsibleMenu";
import { GM_MENU_ITEMS } from "@/components/dashboard/gmMenuItems";
import {
  BackendApiError,
  commitGmProfilePhoto,
  fetchGmProfile,
  logoutCurrentUser,
  presignGmProfilePhoto,
  updateOwnPasswordWithCurrent,
  type GmProfilePayload,
} from "@/lib/api/backend";

const R = "#DC2626";
const GREEN = "#059669";

function fmtDur(minutes: number): string {
  const safe = Math.max(0, Math.round(minutes));
  if (safe < 60) return `${safe} Min`;
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

function fmtDate(value: string | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "-";
  return date.toLocaleDateString("de-AT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function fmtDateTime(value: string | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "-";
  return date.toLocaleString("de-AT", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function monogram(firstName: string, lastName: string): string {
  const first = firstName.trim().charAt(0);
  const last = lastName.trim().charAt(0);
  return `${first}${last}`.toUpperCase() || "GM";
}

function extensionFromFile(file: File): string {
  const byName = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (byName) return byName === "jpeg" ? "jpg" : byName;
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  if (file.type === "image/heic") return "heic";
  if (file.type === "image/heif") return "heif";
  return "jpg";
}

function SkeletonBlock({ style }: { style?: CSSProperties }) {
  return <div className="gm-profile-skeleton" style={style} />;
}

function ProfileSkeleton() {
  return (
    <>
      <section className="gm-profile-hero">
        <SkeletonBlock style={{ width: 72, height: 72, borderRadius: 22 }} />
        <div style={{ flex: 1 }}>
          <SkeletonBlock style={{ width: 180, height: 24, borderRadius: 8 }} />
          <SkeletonBlock style={{ marginTop: 10, width: 260, height: 12, borderRadius: 999 }} />
          <SkeletonBlock style={{ marginTop: 15, width: 320, height: 36, borderRadius: 12 }} />
        </div>
      </section>
      <section className="gm-profile-stat-grid">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="gm-profile-card gm-profile-stat">
            <SkeletonBlock style={{ width: 84, height: 8, borderRadius: 999 }} />
            <SkeletonBlock style={{ marginTop: 12, width: 112, height: 28, borderRadius: 8 }} />
            <SkeletonBlock style={{ marginTop: 12, width: "100%", height: 7, borderRadius: 999 }} />
          </div>
        ))}
      </section>
      <section className="gm-profile-two-col">
        <div className="gm-profile-card" style={{ height: 286 }} />
        <div className="gm-profile-card" style={{ height: 286 }} />
      </section>
    </>
  );
}

function TinyPill({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "red" | "green" | "blue" }) {
  const styles = {
    neutral: { color: "rgba(15,23,42,0.52)", bg: "rgba(15,23,42,0.045)", ring: "rgba(15,23,42,0.06)" },
    red: { color: R, bg: "rgba(220,38,38,0.07)", ring: "rgba(220,38,38,0.12)" },
    green: { color: GREEN, bg: "rgba(5,150,105,0.08)", ring: "rgba(5,150,105,0.13)" },
    blue: { color: "#2563eb", bg: "rgba(37,99,235,0.07)", ring: "rgba(37,99,235,0.13)" },
  }[tone];
  return (
    <span style={{ height: 22, display: "inline-flex", alignItems: "center", padding: "0 8px", borderRadius: 999, background: styles.bg, boxShadow: `inset 0 0 0 1px ${styles.ring}`, color: styles.color, fontSize: 9, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase" }}>
      {children}
    </span>
  );
}

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  accent,
  progress,
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; color?: string }>;
  accent: string;
  progress: number;
}) {
  const width = Math.max(0, Math.min(100, progress));
  return (
    <div className="gm-profile-card gm-profile-stat">
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div className="gm-profile-label">{label}</div>
          <div style={{ marginTop: 8, fontSize: 27, lineHeight: 1, fontWeight: 750, letterSpacing: "-0.02em", color: accent, fontVariantNumeric: "tabular-nums" }}>
            {value}
          </div>
        </div>
        <span style={{ width: 26, height: 26, borderRadius: 10, display: "inline-flex", alignItems: "center", justifyContent: "center", background: `${accent}12`, boxShadow: `inset 0 0 0 1px ${accent}1f` }}>
          <Icon size={14} strokeWidth={2} color={accent} />
        </span>
      </div>
      <div style={{ marginTop: 12, height: 7, borderRadius: 999, overflow: "hidden", background: "rgba(15,23,42,0.055)", boxShadow: "inset 0 0 0 1px rgba(15,23,42,0.025)" }}>
        <div style={{ width: `${width}%`, height: "100%", borderRadius: 999, background: `linear-gradient(90deg, ${accent}, ${accent}99)`, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.26)" }} />
      </div>
      <div style={{ marginTop: 8, fontSize: 10, fontWeight: 650, color: "rgba(15,23,42,0.42)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {sub}
      </div>
    </div>
  );
}

function DataRow({ label, value, icon: Icon }: {
  label: string;
  value: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; color?: string }>;
}) {
  return (
    <div className="gm-profile-data-row">
      <span style={{ width: 28, height: 28, borderRadius: 10, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "rgba(15,23,42,0.035)", boxShadow: "inset 0 0 0 1px rgba(15,23,42,0.055)", flexShrink: 0 }}>
        <Icon size={13} strokeWidth={2} color="rgba(15,23,42,0.42)" />
      </span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div className="gm-profile-label" style={{ marginBottom: 3 }}>{label}</div>
        <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(15,23,42,0.88)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {value || "-"}
        </div>
      </div>
    </div>
  );
}

function PasswordInput({
  label,
  value,
  onChange,
  placeholder,
  visible,
  onToggleVisible,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  visible: boolean;
  onToggleVisible: () => void;
  autoComplete: string;
}) {
  return (
    <label style={{ display: "block" }}>
      <span className="gm-profile-label" style={{ display: "block", marginBottom: 7 }}>{label}</span>
      <span style={{ position: "relative", display: "block" }}>
        <input
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          style={{ width: "100%", height: 40, borderRadius: 11, border: "1px solid rgba(15,23,42,0.08)", background: "rgba(15,23,42,0.028)", outline: "none", padding: "0 38px 0 12px", color: "rgba(15,23,42,0.9)", fontSize: 12, fontWeight: 700, fontFamily: "inherit", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.72)" }}
        />
        <button
          type="button"
          onClick={onToggleVisible}
          aria-label={visible ? "Passwort verbergen" : "Passwort anzeigen"}
          style={{ position: "absolute", top: 6, right: 7, width: 28, height: 28, borderRadius: 9, border: "none", background: "transparent", display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
        >
          {visible ? <EyeOff size={14} strokeWidth={2} color="rgba(15,23,42,0.38)" /> : <Eye size={14} strokeWidth={2} color="rgba(15,23,42,0.38)" />}
        </button>
      </span>
    </label>
  );
}

function PasswordCard() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [visibleField, setVisibleField] = useState<"current" | "new" | "confirm" | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const minLength = 8;
  const newPasswordValid = newPassword.length >= minLength;
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;
  const canSubmit = currentPassword.length > 0 && newPasswordValid && passwordsMatch && !submitting;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      await updateOwnPasswordWithCurrent({
        currentPassword,
        newPassword,
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setVisibleField(null);
      setSuccess("Passwort wurde erfolgreich aktualisiert.");
    } catch (err) {
      if (err instanceof BackendApiError) {
        setError(err.message || "Passwort konnte nicht aktualisiert werden.");
      } else {
        setError("Passwort konnte nicht aktualisiert werden.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="gm-profile-card" style={{ padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 15 }}>
        <div>
          <div className="gm-profile-label">Sicherheit</div>
          <h2 className="gm-profile-section-title">Passwort ändern</h2>
        </div>
        <span style={{ width: 34, height: 34, borderRadius: 12, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "rgba(220,38,38,0.07)", boxShadow: "inset 0 0 0 1px rgba(220,38,38,0.12)" }}>
          <KeyRound size={16} strokeWidth={2} color={R} />
        </span>
      </div>

      <form onSubmit={submit} style={{ display: "grid", gap: 12 }}>
        <PasswordInput
          label="Aktuelles Passwort"
          value={currentPassword}
          onChange={setCurrentPassword}
          placeholder="Zur Verifizierung eingeben"
          visible={visibleField === "current"}
          onToggleVisible={() => setVisibleField((value) => value === "current" ? null : "current")}
          autoComplete="current-password"
        />
        <PasswordInput
          label="Neues Passwort"
          value={newPassword}
          onChange={setNewPassword}
          placeholder="Mindestens 8 Zeichen"
          visible={visibleField === "new"}
          onToggleVisible={() => setVisibleField((value) => value === "new" ? null : "new")}
          autoComplete="new-password"
        />
        <PasswordInput
          label="Neues Passwort bestätigen"
          value={confirmPassword}
          onChange={setConfirmPassword}
          placeholder="Noch einmal eingeben"
          visible={visibleField === "confirm"}
          onToggleVisible={() => setVisibleField((value) => value === "confirm" ? null : "confirm")}
          autoComplete="new-password"
        />

        <div style={{ minHeight: 38 }}>
          {newPassword.length > 0 && !newPasswordValid ? (
            <div className="gm-profile-alert warn">Passwort muss mindestens {minLength} Zeichen enthalten.</div>
          ) : null}
          {confirmPassword.length > 0 && !passwordsMatch ? (
            <div className="gm-profile-alert error">Passwörter stimmen nicht überein.</div>
          ) : null}
          {error ? <div className="gm-profile-alert error">{error}</div> : null}
          {success ? <div className="gm-profile-alert success"><Check size={12} strokeWidth={2.2} /> {success}</div> : null}
        </div>

        <button
          type="submit"
          disabled={!canSubmit}
          style={{ height: 38, borderRadius: 11, border: "none", background: canSubmit ? "linear-gradient(to bottom, #ef4444, #DC2626)" : "rgba(15,23,42,0.11)", color: canSubmit ? "#fff" : "rgba(15,23,42,0.32)", fontSize: 12, fontWeight: 700, cursor: canSubmit ? "pointer" : "not-allowed", fontFamily: "inherit", boxShadow: canSubmit ? "inset 0 1px 0.6px rgba(255,255,255,0.33), inset 0 -1px 0 rgba(255,255,255,0.15), 0 0 0 1px #b91c1c, 0 1px 7px rgba(180,20,20,0.18)" : "none", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7 }}
        >
          {submitting ? <Loader2 size={13} strokeWidth={2} className="animate-spin" /> : <Lock size={13} strokeWidth={2} />}
          {submitting ? "Speichern..." : "Passwort speichern"}
        </button>
      </form>
    </section>
  );
}

export default function GmProfilPage() {
  const router = useRouter();
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [payload, setPayload] = useState<GmProfilePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [photoMenuOpen, setPhotoMenuOpen] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchGmProfile()
      .then((result) => {
        if (!cancelled) setPayload(result);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Profil konnte nicht geladen werden.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const profile = payload?.profile;
  const stats = payload?.stats;
  const fullName = profile ? `${profile.firstName} ${profile.lastName}`.trim() : "";
  const redPeriodSub = stats ? `${stats.redPeriod.label} · ${fmtDate(stats.redPeriod.startDate)}-${fmtDate(stats.redPeriod.endDate)}` : "";
  const latestVisitText = stats?.latestVisit
    ? `${stats.latestVisit.marketName || "Marktbesuch"} · ${fmtDateTime(stats.latestVisit.submittedAt)}`
    : "Noch kein abgeschlossener Besuch";
  const accountAge = useMemo(() => {
    if (!profile?.createdAt) return "-";
    const created = new Date(profile.createdAt).getTime();
    if (!Number.isFinite(created)) return "-";
    const days = Math.max(0, Math.floor((Date.now() - created) / 86_400_000));
    if (days < 31) return `${days} Tage`;
    const months = Math.floor(days / 30);
    return `${months} Monate`;
  }, [profile?.createdAt]);

  async function handleProfilePhotoFile(file: File | null | undefined) {
    if (!file || photoUploading) return;
    setPhotoMenuOpen(false);
    setPhotoError(null);
    if (!file.type.startsWith("image/") && !/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name)) {
      setPhotoError("Bitte ein Bild auswählen.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setPhotoError("Profilfoto darf maximal 5 MB groß sein.");
      return;
    }
    setPhotoUploading(true);
    try {
      const presign = await presignGmProfilePhoto({
        extension: extensionFromFile(file),
        mimeType: file.type || undefined,
      });
      const uploadResponse = await fetch(presign.upload.signedUrl, {
        method: "PUT",
        headers: {
          "content-type": file.type || "application/octet-stream",
        },
        body: file,
      });
      if (!uploadResponse.ok) {
        throw new Error("Profilfoto konnte nicht hochgeladen werden.");
      }
      const committed = await commitGmProfilePhoto({
        storageBucket: presign.upload.bucket,
        storagePath: presign.upload.path,
        mimeType: file.type || undefined,
        byteSize: file.size,
      });
      setPayload((current) => current
        ? {
            ...current,
            profile: {
              ...current.profile,
              profilePhoto: committed.profilePhoto,
              updatedAt: new Date().toISOString(),
            },
          }
        : current);
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : "Profilfoto konnte nicht gespeichert werden.");
    } finally {
      setPhotoUploading(false);
    }
  }

  return (
    <main className="min-h-screen" style={{ position: "relative", backgroundColor: "#f5f5f7", fontFamily: "var(--font-inter), Inter, system-ui, sans-serif", paddingBottom: 112 }}>
      <style>{`
        @keyframes gmProfileFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes gmProfileSkeletonShimmer {
          0% { background-position: 120% 0; }
          100% { background-position: -120% 0; }
        }
        .gm-profile-page { animation: gmProfileFadeIn 0.24s ease both; }
        .gm-profile-skeleton {
          background: linear-gradient(90deg, rgba(15,23,42,0.045), rgba(15,23,42,0.078), rgba(15,23,42,0.045));
          background-size: 220% 100%;
          animation: gmProfileSkeletonShimmer 1.35s ease-in-out infinite;
        }
        .gm-profile-card,
        .gm-profile-hero {
          background: #ffffff;
          border: 1px solid rgba(15,23,42,0.06);
          border-radius: 16px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04);
        }
        .gm-profile-hero {
          display: grid;
          grid-template-columns: minmax(0, 1.14fr) minmax(260px, 0.86fr);
          align-items: stretch;
          gap: 12px;
          padding: 14px;
          overflow: hidden;
          position: relative;
        }
        .gm-profile-hero::after {
          content: "";
          position: absolute;
          right: -48px;
          top: -72px;
          width: 190px;
          height: 190px;
          border-radius: 999px;
          background: radial-gradient(circle, rgba(220,38,38,0.095), transparent 68%);
          pointer-events: none;
        }
        .gm-profile-hero-main {
          position: relative;
          z-index: 1;
          min-width: 0;
          border-radius: 14px;
          padding: 14px;
          background: linear-gradient(180deg, rgba(15,23,42,0.018), rgba(255,255,255,0.52));
          box-shadow: inset 0 0 0 1px rgba(15,23,42,0.045);
          display: flex;
          gap: 13px;
          align-items: center;
        }
        .gm-profile-avatar-wrap {
          position: relative;
          flex-shrink: 0;
        }
        .gm-profile-avatar-button {
          position: relative;
          width: 58px;
          height: 58px;
          border: 0;
          border-radius: 18px;
          padding: 0;
          overflow: visible;
          background: linear-gradient(145deg, rgba(220,38,38,0.14), rgba(255,255,255,0.88));
          box-shadow: inset 0 0 0 1px rgba(220,38,38,0.14), 0 10px 24px rgba(220,38,38,0.075);
          color: #DC2626;
          font-family: inherit;
          cursor: pointer;
        }
        .gm-profile-avatar-button:disabled {
          cursor: default;
          opacity: 0.78;
        }
        .gm-profile-avatar-initials,
        .gm-profile-avatar-image {
          width: 58px;
          height: 58px;
          border-radius: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }
        .gm-profile-avatar-initials {
          font-size: 20px;
          font-weight: 750;
          letter-spacing: 0;
        }
        .gm-profile-avatar-image {
          object-fit: cover;
          box-shadow: inset 0 0 0 1px rgba(15,23,42,0.06);
        }
        .gm-profile-avatar-camera {
          position: absolute;
          right: -5px;
          bottom: -5px;
          width: 24px;
          height: 24px;
          border-radius: 9px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(to bottom, #ef4444, #DC2626);
          color: #fff;
          box-shadow: inset 0 1px 0.6px rgba(255,255,255,0.38), inset 0 -1px 0 rgba(255,255,255,0.14), 0 0 0 2px #fff, 0 8px 16px rgba(220,38,38,0.22);
        }
        .gm-profile-avatar-menu {
          position: absolute;
          top: 68px;
          left: 0;
          width: 196px;
          z-index: 20;
          border-radius: 15px;
          padding: 6px;
          background: rgba(255,255,255,0.98);
          border: 1px solid rgba(15,23,42,0.07);
          box-shadow: 0 16px 38px rgba(15,23,42,0.13), 0 1px 0 rgba(255,255,255,0.9) inset;
          backdrop-filter: blur(14px);
        }
        .gm-profile-avatar-action {
          width: 100%;
          height: 37px;
          border: 0;
          border-radius: 11px;
          background: transparent;
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 0 10px;
          color: rgba(15,23,42,0.78);
          font-family: inherit;
          font-size: 11px;
          font-weight: 780;
          cursor: pointer;
          text-align: left;
        }
        .gm-profile-avatar-action:hover {
          background: rgba(15,23,42,0.045);
        }
        .gm-profile-hero-metrics {
          position: relative;
          z-index: 1;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }
        .gm-profile-hero-metric {
          min-height: 66px;
          border-radius: 13px;
          padding: 11px 12px;
          background: rgba(255,255,255,0.66);
          box-shadow: inset 0 0 0 1px rgba(15,23,42,0.055);
        }
        .gm-profile-hero-strip {
          position: relative;
          z-index: 1;
          grid-column: 1 / -1;
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
        }
        .gm-profile-hero-contact {
          min-width: 0;
          height: 38px;
          border-radius: 12px;
          background: rgba(15,23,42,0.022);
          box-shadow: inset 0 0 0 1px rgba(15,23,42,0.045);
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 0 11px;
          font-size: 11px;
          font-weight: 720;
          color: rgba(15,23,42,0.58);
        }
        .gm-profile-label {
          font-size: 8px;
          font-weight: 700;
          letter-spacing: 0.105em;
          text-transform: uppercase;
          color: rgba(15,23,42,0.34);
        }
        .gm-profile-section-title {
          margin: 4px 0 0;
          font-size: 15px;
          line-height: 1.1;
          font-weight: 750;
          letter-spacing: -0.03em;
          color: rgba(15,23,42,0.94);
        }
        .gm-profile-stat-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
          margin-top: 14px;
        }
        .gm-profile-stat {
          min-height: 134px;
          padding: 15px;
        }
        .gm-profile-two-col {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(320px, 0.88fr);
          gap: 14px;
          margin-top: 14px;
        }
        .gm-profile-data-row {
          display: flex;
          align-items: center;
          gap: 10px;
          min-height: 48px;
          border-bottom: 1px solid rgba(15,23,42,0.045);
        }
        .gm-profile-data-row:last-child {
          border-bottom: none;
        }
        .gm-profile-alert {
          min-height: 26px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 9px;
          border-radius: 9px;
          font-size: 10px;
          font-weight: 760;
          line-height: 1.35;
        }
        .gm-profile-alert.error {
          background: rgba(220,38,38,0.06);
          color: #DC2626;
          box-shadow: inset 0 0 0 1px rgba(220,38,38,0.12);
        }
        .gm-profile-alert.warn {
          background: rgba(217,119,6,0.07);
          color: #b45309;
          box-shadow: inset 0 0 0 1px rgba(217,119,6,0.13);
        }
        .gm-profile-alert.success {
          background: rgba(5,150,105,0.08);
          color: #047857;
          box-shadow: inset 0 0 0 1px rgba(5,150,105,0.14);
        }
        @media (max-width: 840px) {
          .gm-profile-hero,
          .gm-profile-two-col {
            grid-template-columns: 1fr;
          }
          .gm-profile-hero-strip {
            grid-template-columns: 1fr;
          }
          .gm-profile-stat-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (max-width: 560px) {
          .gm-profile-stat-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: 420, pointerEvents: "none", zIndex: 0, opacity: 0.35 }}>
        <Aurora colorStops={["#F4B4B4", "#DC2626", "#F4B4B4"]} blend={0.6} amplitude={0.8} speed={0.3} />
      </div>

      <div className="gm-profile-page mx-auto px-6 pt-6 lg:px-10 lg:pt-8" style={{ maxWidth: 960, position: "relative", zIndex: 1 }}>
        <header style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(220,38,38,0.62)", marginBottom: 5 }}>
              Profil
            </div>
            <h1 style={{ margin: 0, fontSize: 26, lineHeight: 1.08, fontWeight: 750, letterSpacing: "-0.02em", color: "rgba(15,23,42,0.94)" }}>
              Mein Profil
            </h1>
            <p style={{ margin: "7px 0 0", maxWidth: 460, fontSize: 12, lineHeight: 1.55, fontWeight: 560, color: "rgba(15,23,42,0.48)" }}>
              Persönliche Daten, Kennzahlen und Sicherheit an einem Ort.
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => router.push("/datenschutz/gm")}
              style={{ height: 28, display: "inline-flex", alignItems: "center", gap: 6, padding: "0 10px", borderRadius: 999, border: "1px solid rgba(15,23,42,0.06)", background: "#ffffff", boxShadow: "0 1px 5px rgba(15,23,42,0.06), inset 0 1px 0 rgba(255,255,255,0.9)", fontSize: 10, fontWeight: 760, color: "rgba(15,23,42,0.62)", whiteSpace: "nowrap", cursor: "pointer", fontFamily: "inherit" }}
            >
              <ShieldCheck size={12} strokeWidth={2} />
              Datenschutz
            </button>
            <button
              type="button"
              onClick={() => router.push("/vereinbarung")}
              style={{ height: 28, display: "inline-flex", alignItems: "center", gap: 6, padding: "0 10px", borderRadius: 999, border: "1px solid rgba(15,23,42,0.06)", background: "#ffffff", boxShadow: "0 1px 5px rgba(15,23,42,0.06), inset 0 1px 0 rgba(255,255,255,0.9)", fontSize: 10, fontWeight: 760, color: "rgba(15,23,42,0.62)", whiteSpace: "nowrap", cursor: "pointer", fontFamily: "inherit" }}
            >
              <FileCheck2 size={12} strokeWidth={2} />
              Vereinbarung
            </button>
            <span style={{ height: 28, display: "inline-flex", alignItems: "center", gap: 6, padding: "0 10px", borderRadius: 999, background: "#ffffff", boxShadow: "0 1px 5px rgba(15,23,42,0.06), inset 0 0 0 1px rgba(15,23,42,0.06)", fontSize: 10, fontWeight: 700, color: "rgba(15,23,42,0.48)", whiteSpace: "nowrap" }}>
              <ShieldCheck size={12} strokeWidth={2} />
              Aktiver Account
            </span>
          </div>
        </header>

        {loading ? (
          <ProfileSkeleton />
        ) : error ? (
          <section className="gm-profile-card" style={{ padding: 18 }}>
            <div className="gm-profile-alert error">{error}</div>
          </section>
        ) : profile && stats ? (
          <>
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                event.currentTarget.value = "";
                void handleProfilePhotoFile(file);
              }}
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="user"
              style={{ display: "none" }}
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                event.currentTarget.value = "";
                void handleProfilePhotoFile(file);
              }}
            />
            <section className="gm-profile-hero">
              <div className="gm-profile-hero-main">
                <div className="gm-profile-avatar-wrap">
                  <button
                    type="button"
                    className="gm-profile-avatar-button"
                    onClick={() => setPhotoMenuOpen((open) => !open)}
                    disabled={photoUploading}
                    aria-label="Profilfoto ändern"
                  >
                    {profile.profilePhoto?.signedUrl ? (
                      <img className="gm-profile-avatar-image" src={profile.profilePhoto.signedUrl} alt="Profilfoto" />
                    ) : (
                      <span className="gm-profile-avatar-initials">{monogram(profile.firstName, profile.lastName)}</span>
                    )}
                    <span className="gm-profile-avatar-camera">
                      {photoUploading ? <Loader2 size={13} strokeWidth={2.2} className="animate-spin" /> : <Camera size={13} strokeWidth={2.2} />}
                    </span>
                  </button>
                  {photoMenuOpen ? (
                    <div className="gm-profile-avatar-menu">
                      <button type="button" className="gm-profile-avatar-action" onClick={() => galleryInputRef.current?.click()}>
                        <ImagePlus size={14} strokeWidth={2.1} />
                        Aus Galerie wählen
                      </button>
                      <button type="button" className="gm-profile-avatar-action" onClick={() => cameraInputRef.current?.click()}>
                        <Camera size={14} strokeWidth={2.1} />
                        Foto aufnehmen
                      </button>
                    </div>
                  ) : null}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap", marginBottom: 7 }}>
                    <TinyPill tone="red">Gebietsmanager</TinyPill>
                    {profile.region ? <TinyPill tone="neutral">{profile.region}</TinyPill> : null}
                    {profile.isBillaGm ? <TinyPill tone="blue">Billa GM</TinyPill> : null}
                  </div>
                  <h2 style={{ margin: 0, fontSize: 26, lineHeight: 1.04, fontWeight: 750, letterSpacing: "-0.02em", color: "rgba(15,23,42,0.94)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {fullName}
                  </h2>
                  <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 7, color: "rgba(15,23,42,0.48)", fontSize: 12, fontWeight: 680 }}>
                    <Mail size={13} strokeWidth={2} />
                    <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{profile.email}</span>
                  </div>
                  {photoError ? (
                    <div className="gm-profile-alert error" style={{ marginTop: 9 }}>
                      {photoError}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="gm-profile-hero-metrics">
                <div className="gm-profile-hero-metric" style={{ background: "rgba(5,150,105,0.045)" }}>
                  <div className="gm-profile-label">Status</div>
                  <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 6, fontSize: 16, fontWeight: 750, letterSpacing: "-0.02em", color: GREEN }}>
                    <span style={{ width: 7, height: 7, borderRadius: 999, background: GREEN, boxShadow: "0 0 0 3px rgba(5,150,105,0.1)" }} />
                    Aktiv
                  </div>
                </div>
                <div className="gm-profile-hero-metric">
                  <div className="gm-profile-label">Account seit</div>
                  <div style={{ marginTop: 6, fontSize: 16, fontWeight: 750, letterSpacing: "-0.02em", color: "rgba(15,23,42,0.88)" }}>{accountAge}</div>
                </div>
                <div className="gm-profile-hero-metric">
                  <div className="gm-profile-label">RED Besuche</div>
                  <div style={{ marginTop: 6, fontSize: 16, fontWeight: 750, letterSpacing: "-0.02em", color: R }}>{stats.currentRedVisitCount}</div>
                </div>
                <div className="gm-profile-hero-metric">
                  <div className="gm-profile-label">Woche</div>
                  <div style={{ marginTop: 6, fontSize: 16, fontWeight: 750, letterSpacing: "-0.02em", color: "rgba(15,23,42,0.88)" }}>{fmtDur(stats.weekWorkMinutes)}</div>
                </div>
              </div>

              <div className="gm-profile-hero-strip">
                <div className="gm-profile-hero-contact">
                  <Mail size={13} strokeWidth={2} color="rgba(15,23,42,0.34)" />
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{profile.email}</span>
                </div>
                <div className="gm-profile-hero-contact">
                  <Phone size={13} strokeWidth={2} color="rgba(15,23,42,0.34)" />
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{profile.phone || "Keine Telefonnummer"}</span>
                </div>
                <div className="gm-profile-hero-contact">
                  <MapPin size={13} strokeWidth={2} color="rgba(15,23,42,0.34)" />
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{[profile.postalCode, profile.city].filter(Boolean).join(" ") || profile.region || "-"}</span>
                </div>
              </div>
            </section>

            <section className="gm-profile-stat-grid">
              <StatCard
                label="RED Besuche"
                value={String(stats.currentRedVisitCount)}
                sub={redPeriodSub}
                icon={Store}
                accent={R}
                progress={Math.min(100, stats.currentRedVisitCount * 12)}
              />
              <StatCard
                label="Alle Besuche"
                value={String(stats.allTimeVisitCount)}
                sub={latestVisitText}
                icon={Activity}
                accent="#2563eb"
                progress={Math.min(100, stats.allTimeVisitCount)}
              />
              <StatCard
                label="Bonus gesamt"
                value={`${Math.round(stats.bonusCumulativeEur)}€`}
                sub="Kumuliert aus Prämien"
                icon={Trophy}
                accent="#d97706"
                progress={Math.min(100, Math.round((stats.bonusCumulativeEur / 1100) * 100))}
              />
              <StatCard
                label="Arbeitsrhythmus"
                value={fmtDur(stats.weekWorkMinutes)}
                sub={`Ø Arbeitstag ${fmtDur(stats.averageWorkdayMin)} · ${stats.trackedWeekDays} Tage`}
                icon={User}
                accent={GREEN}
                progress={Math.min(100, Math.round((stats.weekWorkMinutes / (38.5 * 60)) * 100))}
              />
            </section>

            <section className="gm-profile-two-col">
              <section className="gm-profile-card" style={{ padding: 16 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
                  <div>
                    <div className="gm-profile-label">Stammdaten</div>
                    <h2 className="gm-profile-section-title">Persönliche Daten</h2>
                  </div>
                  <TinyPill>Read-only</TinyPill>
                </div>
                <DataRow label="E-Mail" value={profile.email} icon={Mail} />
                <DataRow label="Telefon" value={profile.phone} icon={Phone} />
                <DataRow label="Adresse" value={profile.address} icon={MapPin} />
                <DataRow label="PLZ / Ort" value={[profile.postalCode, profile.city].filter(Boolean).join(" ")} icon={MapPin} />
                <DataRow label="Region" value={profile.region} icon={ShieldCheck} />
                <DataRow label="Zuweisung" value={profile.isBillaGm ? "Billa GM" : "Standard GM"} icon={Store} />
              </section>

              <PasswordCard />
            </section>
          </>
        ) : null}
      </div>

      <div className="fixed bottom-6 left-0 right-0 z-50">
        <CollapsibleMenu
          items={GM_MENU_ITEMS}
          enableKurti
          defaultIndex={3}
          onSelect={(_index, item) => {
            if (item.action === "logout") {
              logoutCurrentUser();
              if (typeof window !== "undefined") {
                window.location.assign("/");
                return;
              }
              router.replace("/");
              router.refresh();
              return;
            }
            if (item.href) {
              router.push(item.href);
            }
          }}
        />
      </div>
    </main>
  );
}
