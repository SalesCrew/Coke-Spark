import Link from "next/link";

export type PrivacyNoticeSection = {
  title: string;
  body: string[];
};

type PrivacyNoticeProps = {
  eyebrow: string;
  title: string;
  subtitle: string;
  audienceLabel: string;
  sections: PrivacyNoticeSection[];
  backHref?: string;
};

export function PrivacyNotice({
  eyebrow,
  title,
  subtitle,
  audienceLabel,
  sections,
  backHref = "/",
}: PrivacyNoticeProps) {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#ffffff",
        color: "#0f172a",
        fontFamily: "var(--font-inter), Inter, system-ui, sans-serif",
      }}
    >
      <article style={{ maxWidth: 940, margin: "0 auto", padding: "42px 22px 72px" }}>
        <header style={{ marginBottom: 26, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 18 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(220,38,38,0.68)", marginBottom: 9 }}>
              {eyebrow}
            </div>
            <h1 style={{ margin: 0, fontSize: 34, lineHeight: 1.04, letterSpacing: "-0.035em", fontWeight: 760 }}>
              {title}
            </h1>
            <p style={{ margin: "12px 0 0", maxWidth: 690, fontSize: 14, lineHeight: 1.7, color: "rgba(15,23,42,0.62)", fontWeight: 520 }}>
              {subtitle}
            </p>
          </div>
          <Link
            href={backHref}
            style={{
              height: 34,
              padding: "0 14px",
              borderRadius: 10,
              border: "1px solid rgba(15,23,42,0.1)",
              background: "#fff",
              color: "rgba(15,23,42,0.72)",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              fontWeight: 750,
              boxShadow: "0 1px 3px rgba(15,23,42,0.06)",
              whiteSpace: "nowrap",
            }}
          >
            Zurück
          </Link>
        </header>

        <section
          style={{
            border: "1px solid rgba(220,38,38,0.14)",
            background: "linear-gradient(180deg, rgba(254,242,242,0.85), rgba(255,255,255,0.96))",
            borderRadius: 18,
            padding: 18,
            marginBottom: 18,
            boxShadow: "0 6px 22px rgba(15,23,42,0.04)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 7 }}>
            <span style={{ fontSize: 12, fontWeight: 820, color: "#b91c1c" }}>Wichtige Pflichtangaben</span>
            <span style={{ padding: "4px 8px", borderRadius: 999, background: "#fff", border: "1px solid rgba(220,38,38,0.1)", fontSize: 10, fontWeight: 760, color: "rgba(15,23,42,0.58)" }}>
              {audienceLabel}
            </span>
          </div>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.65, color: "rgba(15,23,42,0.68)", fontWeight: 560 }}>
            Verantwortlicher, Datenschutzkontakt, konkrete Empfängerlisten und finale Aufbewahrungsfristen müssen mit den tatsächlichen Unternehmens- und Vertragsdaten ergänzt werden. Die folgende Information ist dafür vorbereitet und auf den aktuellen Coke-Spark-Einsatz zugeschnitten.
          </p>
        </section>

        <div style={{ display: "grid", gap: 12 }}>
          {sections.map((section) => (
            <section
              key={section.title}
              style={{
                border: "1px solid rgba(15,23,42,0.08)",
                borderRadius: 16,
                padding: "18px 20px",
                background: "#fff",
                boxShadow: "0 1px 5px rgba(15,23,42,0.035)",
              }}
            >
              <h2 style={{ margin: 0, fontSize: 15, lineHeight: 1.25, fontWeight: 820, letterSpacing: "-0.015em", color: "rgba(15,23,42,0.92)" }}>
                {section.title}
              </h2>
              <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                {section.body.map((paragraph) => (
                  <p key={paragraph} style={{ margin: 0, fontSize: 13, lineHeight: 1.72, color: "rgba(15,23,42,0.67)", fontWeight: 520 }}>
                    {paragraph}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>

        <footer style={{ marginTop: 24, borderTop: "1px solid rgba(15,23,42,0.08)", paddingTop: 18, color: "rgba(15,23,42,0.46)", fontSize: 12, lineHeight: 1.7 }}>
          <p style={{ margin: 0 }}>
            Stand: 29.06.2026. Diese Information orientiert sich an den Transparenzpflichten nach Art. 13 und 14 DSGVO sowie am Beschäftigtendatenkontext nach Art. 88 DSGVO.
          </p>
        </footer>
      </article>
    </main>
  );
}
