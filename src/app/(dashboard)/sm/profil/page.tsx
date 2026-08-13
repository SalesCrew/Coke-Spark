"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  CalendarCheck2,
  Check,
  Clock,
  Eye,
  EyeOff,
  Home,
  KeyRound,
  Loader2,
  Lock,
  LogOut,
  Mail,
  MapPin,
  Phone,
  Store,
  User,
} from "lucide-react";
import { CollapsibleMenu, type MenuItem } from "@/components/ui/CollapsibleMenu";
import {
  BackendApiError,
  fetchCurrentAuthUser,
  logoutCurrentUser,
  updateOwnPasswordWithCurrent,
} from "@/lib/api/backend";

const RED = "#dc2626";
const GREEN = "#059669";

type SmProfileUser = {
  id: string;
  role: "sm";
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  postalCode?: string | null;
  region?: string | null;
  isActive?: boolean;
};

const MENU_ITEMS: MenuItem[] = [
  { label: "Home", href: "/sm", icon: <Home size={11} strokeWidth={1.8} /> },
  { label: "Aktivitäten", href: "/sm/aktivitaet", icon: <Activity size={11} strokeWidth={1.8} /> },
  { label: "Zeiterfassung", href: "/sm/zeiterfassung", icon: <Clock size={11} strokeWidth={1.8} /> },
  { label: "Profil", href: "/sm/profil", icon: <User size={11} strokeWidth={1.8} /> },
  { label: "Logout", icon: <LogOut size={11} strokeWidth={1.9} />, action: "logout", tone: "danger" },
];

const PROFILE_METRICS = [
  { label: "Stammmärkte", value: "3", helper: "aktuell zugeordnet", icon: Store, color: RED },
  { label: "Einsätze", value: "4/6", helper: "diese Woche", icon: CalendarCheck2, color: GREEN },
  { label: "Sollzeit", value: "10 h", helper: "diese Woche", icon: Clock, color: "#475569" },
  { label: "Istzeit", value: "6 h 59 min", helper: "bereits erfasst", icon: Check, color: GREEN },
] as const;

function initials(user: SmProfileUser | null) {
  if (!user) return "SM";
  return `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase() || "SM";
}

function fullName(user: SmProfileUser | null) {
  if (!user) return "Shelf Merchandiser";
  return `${user.firstName} ${user.lastName}`.trim() || "Shelf Merchandiser";
}

function compactLocation(user: SmProfileUser | null) {
  if (!user) return "Nicht hinterlegt";
  const location = [user.postalCode, user.city].filter(Boolean).join(" ");
  return location || user.region || "Nicht hinterlegt";
}

function ProfileMetric({
  label,
  value,
  helper,
  icon: Icon,
  color,
}: (typeof PROFILE_METRICS)[number]) {
  return (
    <article className="sm-profile-metric">
      <div className="sm-profile-metric-icon" style={{ color }}>
        <Icon size={13} strokeWidth={1.9} />
      </div>
      <span>{label}</span>
      <strong style={{ color }}>{value}</strong>
      <small>{helper}</small>
    </article>
  );
}

function ProfileRow({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Mail;
}) {
  return (
    <div className="sm-profile-data-row">
      <span className="sm-profile-data-icon"><Icon size={13} strokeWidth={1.8} /></span>
      <span className="sm-profile-data-copy">
        <small>{label}</small>
        <strong>{value}</strong>
      </span>
    </div>
  );
}

function PasswordField({
  label,
  value,
  visible,
  autoComplete,
  onChange,
  onToggle,
}: {
  label: string;
  value: string;
  visible: boolean;
  autoComplete: string;
  onChange: (value: string) => void;
  onToggle: () => void;
}) {
  return (
    <label className="sm-profile-password-field">
      <span>{label}</span>
      <div>
        <Lock size={13} strokeWidth={1.8} aria-hidden />
        <input
          type={visible ? "text" : "password"}
          value={value}
          autoComplete={autoComplete}
          onChange={(event) => onChange(event.target.value)}
        />
        <button type="button" onClick={onToggle} aria-label={visible ? `${label} ausblenden` : `${label} anzeigen`}>
          {visible ? <EyeOff size={14} strokeWidth={1.8} /> : <Eye size={14} strokeWidth={1.8} />}
        </button>
      </div>
    </label>
  );
}

function PasswordCard() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [visibleField, setVisibleField] = useState<"current" | "new" | "confirm" | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const passwordValid = newPassword.length >= 8;
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;
  const canSubmit = currentPassword.length > 0 && passwordValid && passwordsMatch && !submitting;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setMessage(null);
    try {
      await updateOwnPasswordWithCurrent({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setVisibleField(null);
      setMessage({ tone: "success", text: "Dein Passwort wurde geändert." });
    } catch (error) {
      const text = error instanceof BackendApiError
        ? error.message
        : "Das Passwort konnte nicht geändert werden.";
      setMessage({ tone: "error", text });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="sm-profile-card sm-profile-password-card" onSubmit={submit}>
      <div className="sm-profile-section-heading">
        <div>
          <span className="sm-profile-section-icon"><KeyRound size={14} strokeWidth={1.8} /></span>
          <div>
            <h2>Passwort ändern</h2>
            <p>Mindestens 8 Zeichen verwenden.</p>
          </div>
        </div>
      </div>

      <div className="sm-profile-password-fields">
        <PasswordField
          label="Aktuelles Passwort"
          value={currentPassword}
          visible={visibleField === "current"}
          autoComplete="current-password"
          onChange={setCurrentPassword}
          onToggle={() => setVisibleField((value) => value === "current" ? null : "current")}
        />
        <PasswordField
          label="Neues Passwort"
          value={newPassword}
          visible={visibleField === "new"}
          autoComplete="new-password"
          onChange={setNewPassword}
          onToggle={() => setVisibleField((value) => value === "new" ? null : "new")}
        />
        <PasswordField
          label="Passwort bestätigen"
          value={confirmPassword}
          visible={visibleField === "confirm"}
          autoComplete="new-password"
          onChange={setConfirmPassword}
          onToggle={() => setVisibleField((value) => value === "confirm" ? null : "confirm")}
        />
      </div>

      <div className="sm-profile-password-checks" aria-live="polite">
        <span className={passwordValid ? "valid" : ""}><Check size={10} /> Mindestens 8 Zeichen</span>
        <span className={passwordsMatch ? "valid" : ""}><Check size={10} /> Passwörter stimmen überein</span>
      </div>

      {message ? <p className={`sm-profile-message ${message.tone}`}>{message.text}</p> : null}

      <button className="sm-profile-submit" type="submit" disabled={!canSubmit}>
        {submitting ? <Loader2 size={14} className="sm-profile-spinner" /> : <KeyRound size={13} />}
        Passwort speichern
      </button>
    </form>
  );
}

export default function SmProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<SmProfileUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetchCurrentAuthUser()
      .then((payload) => {
        if (active) setUser(payload as SmProfileUser);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const contactRows = useMemo(() => [
    { label: "E-Mail", value: user?.email || "Nicht hinterlegt", icon: Mail },
    { label: "Telefon", value: user?.phone || "Nicht hinterlegt", icon: Phone },
    { label: "Adresse", value: user?.address || "Nicht hinterlegt", icon: MapPin },
    { label: "PLZ & Ort", value: compactLocation(user), icon: Store },
  ], [user]);

  return (
    <main className="sm-profile-page">
      <div className="sm-profile-shell">
        <header className="sm-profile-page-header">
          <span>Profil</span>
          <h1>Mein Profil</h1>
          <p>Persönliche Daten und Zugang verwalten.</p>
        </header>

        <section className="sm-profile-hero">
          <div className="sm-profile-identity">
            <div className="sm-profile-avatar" aria-hidden>{loading ? "…" : initials(user)}</div>
            <div className="sm-profile-identity-copy">
              <span>Shelf Merchandiser</span>
              <h2>{loading ? "Profil wird geladen" : fullName(user)}</h2>
              <div className="sm-profile-status"><i /> Aktiv</div>
            </div>
          </div>
          <div className="sm-profile-hero-contact">
            <Mail size={13} strokeWidth={1.8} />
            <span>{user?.email || (loading ? "Wird geladen …" : "Nicht hinterlegt")}</span>
          </div>
        </section>

        <section className="sm-profile-metric-grid" aria-label="Wochenübersicht">
          {PROFILE_METRICS.map((metric) => <ProfileMetric key={metric.label} {...metric} />)}
        </section>

        <section className="sm-profile-card">
          <div className="sm-profile-section-heading">
            <div>
              <span className="sm-profile-section-icon"><User size={14} strokeWidth={1.8} /></span>
              <div>
                <h2>Persönliche Daten</h2>
                <p>Deine aktuell hinterlegten Kontaktdaten.</p>
              </div>
            </div>
          </div>
          <div className="sm-profile-data-list">
            {contactRows.map((row) => <ProfileRow key={row.label} {...row} />)}
          </div>
        </section>

        <PasswordCard />
      </div>

      <div className="sm-profile-menu">
        <CollapsibleMenu
          items={MENU_ITEMS}
          enableKurti
          featureKurti={false}
          kurtiMaxWidth={420}
          enableClickToggle
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
            if (item.href) router.push(item.href);
          }}
        />
      </div>

      <style jsx global>{`
        .sm-profile-page {
          min-height: 100vh;
          background: #f5f5f7;
          color: #111827;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          padding: 22px 12px 116px;
        }
        .sm-profile-shell { width: min(100%, 420px); margin: 0 auto; }
        .sm-profile-page-header { padding: 0 3px 14px; }
        .sm-profile-page-header > span {
          display: block; color: ${RED}; font-size: 8px; font-weight: 800;
          letter-spacing: .12em; text-transform: uppercase; margin-bottom: 4px;
        }
        .sm-profile-page-header h1 { margin: 0; font-size: 22px; line-height: 1.08; letter-spacing: -.035em; font-weight: 780; }
        .sm-profile-page-header p { margin: 5px 0 0; color: #8b919c; font-size: 11px; line-height: 1.4; }
        .sm-profile-hero, .sm-profile-card, .sm-profile-metric {
          background: #fff; border: 1px solid rgba(15, 23, 42, .06);
          box-shadow: 0 2px 8px rgba(15, 23, 42, .035);
        }
        .sm-profile-hero { border-radius: 17px; padding: 14px; }
        .sm-profile-identity { display: flex; align-items: center; gap: 11px; min-width: 0; }
        .sm-profile-avatar {
          width: 50px; height: 50px; flex: 0 0 50px; display: grid; place-items: center;
          border-radius: 16px; background: linear-gradient(145deg, #fee2e2, #fff1f2);
          color: ${RED}; border: 1px solid rgba(220, 38, 38, .12); font-size: 16px; font-weight: 800;
        }
        .sm-profile-identity-copy { min-width: 0; }
        .sm-profile-identity-copy > span {
          display: block; color: #a1a6af; font-size: 7.5px; font-weight: 800;
          letter-spacing: .1em; text-transform: uppercase; margin-bottom: 2px;
        }
        .sm-profile-identity-copy h2 {
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
          margin: 0; font-size: 16px; line-height: 1.2; letter-spacing: -.025em; font-weight: 760;
        }
        .sm-profile-status {
          display: inline-flex; align-items: center; gap: 5px; color: ${GREEN}; margin-top: 5px;
          font-size: 9px; line-height: 1; font-weight: 700;
        }
        .sm-profile-status i { width: 5px; height: 5px; border-radius: 99px; background: ${GREEN}; }
        .sm-profile-hero-contact {
          margin-top: 12px; padding-top: 11px; border-top: 1px solid #f0f1f3;
          display: flex; align-items: center; gap: 8px; color: #858b95; min-width: 0;
          font-size: 10px; font-weight: 550;
        }
        .sm-profile-hero-contact svg { flex: 0 0 auto; color: #a5aab2; }
        .sm-profile-hero-contact span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .sm-profile-metric-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin-top: 9px; }
        .sm-profile-metric { min-width: 0; min-height: 108px; border-radius: 15px; padding: 11px 12px; }
        .sm-profile-metric-icon {
          width: 27px; height: 27px; border-radius: 9px; display: grid; place-items: center;
          margin-bottom: 11px; background: #f7f7f8;
        }
        .sm-profile-metric > span {
          display: block; color: #9aa0aa; font-size: 7.5px; font-weight: 800;
          letter-spacing: .095em; text-transform: uppercase;
        }
        .sm-profile-metric strong {
          display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
          margin-top: 3px; font-size: 17px; line-height: 1.12; letter-spacing: -.035em; font-weight: 790;
        }
        .sm-profile-metric small { display: block; margin-top: 3px; color: #a1a6af; font-size: 8.5px; }
        .sm-profile-card { border-radius: 17px; padding: 14px; margin-top: 9px; }
        .sm-profile-section-heading { margin-bottom: 12px; }
        .sm-profile-section-heading > div { display: flex; align-items: center; gap: 9px; }
        .sm-profile-section-icon {
          width: 30px; height: 30px; border-radius: 10px; display: grid; place-items: center;
          background: #f7f7f8; color: #7d838d; flex: 0 0 auto;
        }
        .sm-profile-section-heading h2 { margin: 0; font-size: 13px; line-height: 1.2; letter-spacing: -.02em; font-weight: 760; }
        .sm-profile-section-heading p { margin: 2px 0 0; color: #a0a5ae; font-size: 8.5px; line-height: 1.35; }
        .sm-profile-data-list { border-top: 1px solid #f1f2f4; }
        .sm-profile-data-row { display: flex; align-items: center; gap: 9px; padding: 10px 0; border-bottom: 1px solid #f1f2f4; }
        .sm-profile-data-row:last-child { border-bottom: 0; padding-bottom: 1px; }
        .sm-profile-data-icon {
          width: 28px; height: 28px; flex: 0 0 28px; border-radius: 9px;
          display: grid; place-items: center; background: #f8f8f9; color: #9197a0;
        }
        .sm-profile-data-copy { min-width: 0; }
        .sm-profile-data-copy small {
          display: block; color: #a0a5ae; font-size: 7.5px; font-weight: 750;
          letter-spacing: .08em; text-transform: uppercase; margin-bottom: 2px;
        }
        .sm-profile-data-copy strong {
          display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
          color: #303642; font-size: 10.5px; line-height: 1.25; font-weight: 620;
        }
        .sm-profile-password-fields { display: grid; gap: 9px; }
        .sm-profile-password-field > span { display: block; margin: 0 0 4px 2px; color: #777e88; font-size: 8.5px; font-weight: 650; }
        .sm-profile-password-field > div {
          height: 40px; display: flex; align-items: center; gap: 8px; padding: 0 8px 0 11px;
          border: 1px solid #e7e8eb; border-radius: 11px; background: #fafafa;
          color: #a1a6af; transition: border-color 150ms ease, background 150ms ease;
        }
        .sm-profile-password-field > div:focus-within { border-color: #d6d8dc; background: #fff; }
        .sm-profile-password-field input { min-width: 0; flex: 1; border: 0; outline: 0; background: transparent; color: #202631; font-size: 11px; }
        .sm-profile-password-field button {
          width: 28px; height: 28px; border: 0; border-radius: 8px; background: transparent;
          display: grid; place-items: center; color: #9096a0; cursor: pointer;
        }
        .sm-profile-password-checks { display: flex; flex-wrap: wrap; gap: 6px 10px; margin: 10px 1px 0; }
        .sm-profile-password-checks span { display: inline-flex; align-items: center; gap: 4px; color: #afb3ba; font-size: 8px; }
        .sm-profile-password-checks span.valid { color: ${GREEN}; }
        .sm-profile-message { margin: 10px 1px 0; padding: 8px 9px; border-radius: 9px; font-size: 9px; line-height: 1.35; }
        .sm-profile-message.success { color: #047857; background: #ecfdf5; }
        .sm-profile-message.error { color: #b91c1c; background: #fef2f2; }
        .sm-profile-submit {
          width: 100%; height: 39px; margin-top: 12px; border: 1px solid rgba(185, 28, 28, .38);
          border-radius: 11px; display: flex; align-items: center; justify-content: center; gap: 7px;
          color: #fff; background: linear-gradient(180deg, #ef3038 0%, #dc2626 100%);
          box-shadow: inset 0 1px 0 rgba(255,255,255,.36), 0 2px 5px rgba(220,38,38,.16);
          font-size: 10px; font-weight: 750; cursor: pointer;
        }
        .sm-profile-submit:disabled {
          color: #a8adb5; border-color: #e4e5e8; background: #f2f3f4; box-shadow: none; cursor: default;
        }
        .sm-profile-spinner { animation: sm-profile-spin .8s linear infinite; }
        .sm-profile-menu { position: fixed; z-index: 50; left: 0; right: 0; bottom: 24px; }
        @keyframes sm-profile-spin { to { transform: rotate(360deg); } }
        @media (max-width: 360px) {
          .sm-profile-page { padding-inline: 10px; }
          .sm-profile-metric { padding-inline: 10px; }
          .sm-profile-metric strong { font-size: 16px; }
        }
      `}</style>
    </main>
  );
}
