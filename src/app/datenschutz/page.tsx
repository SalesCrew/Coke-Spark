import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Datenschutz | Coke Spark",
  description: "Auswahl der Datenschutzinformationen für Coke Spark.",
};

const cards = [
  {
    href: "/datenschutz/gm",
    label: "GM / SM",
    title: "Field-Force Datenschutz",
    text: "Für Gebietsmanager, Shelf Merchandiser und externe Field-Force-Mitarbeitende.",
  },
  {
    href: "/datenschutz/admin",
    label: "Admin / Kunde",
    title: "Admin & Kunden-Zugänge",
    text: "Für interne Admins, verantwortliche Manager und freigeschaltete Coca-Cola Kunden-Zugänge.",
  },
];

export default function DatenschutzIndexPage() {
  return (
    <main style={{ minHeight: "100vh", background: "#fff", color: "#0f172a", fontFamily: "var(--font-inter), Inter, system-ui, sans-serif" }}>
      <section style={{ maxWidth: 820, margin: "0 auto", padding: "52px 22px" }}>
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(220,38,38,0.68)", marginBottom: 9 }}>
          Datenschutz
        </div>
        <h1 style={{ margin: 0, fontSize: 34, lineHeight: 1.04, letterSpacing: "-0.035em", fontWeight: 760 }}>
          Datenschutzinformation auswählen
        </h1>
        <p style={{ margin: "12px 0 24px", maxWidth: 640, fontSize: 14, lineHeight: 1.7, color: "rgba(15,23,42,0.62)", fontWeight: 520 }}>
          Coke Spark verarbeitet unterschiedliche Daten je nach Rolle. Wähle die passende Information für deinen Zugang.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
          {cards.map((card) => (
            <Link
              key={card.href}
              href={card.href}
              style={{
                textDecoration: "none",
                color: "inherit",
                border: "1px solid rgba(15,23,42,0.08)",
                borderRadius: 18,
                padding: 18,
                background: "linear-gradient(180deg, #fff, rgba(248,250,252,0.84))",
                boxShadow: "0 8px 22px rgba(15,23,42,0.06)",
                display: "block",
              }}
            >
              <span style={{ display: "inline-flex", height: 22, alignItems: "center", padding: "0 8px", borderRadius: 999, background: "rgba(220,38,38,0.07)", color: "#dc2626", fontSize: 10, fontWeight: 820 }}>
                {card.label}
              </span>
              <h2 style={{ margin: "12px 0 6px", fontSize: 18, letterSpacing: "-0.02em", fontWeight: 820 }}>{card.title}</h2>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: "rgba(15,23,42,0.58)", fontWeight: 540 }}>{card.text}</p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
