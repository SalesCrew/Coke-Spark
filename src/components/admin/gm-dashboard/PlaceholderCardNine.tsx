"use client";

export function PlaceholderCardNine() {
  return (
    <section
      style={{
        background: "rgba(0,0,0,0.025)",
        border: "1px solid rgba(0,0,0,0.07)",
        borderRadius: 14,
        padding: 10,
        minHeight: 360,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 12,
          border: "1px solid rgba(0,0,0,0.06)",
          boxShadow: "0 1px 6px rgba(0,0,0,0.05)",
          padding: "10px 12px",
        }}
      >
        <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(0,0,0,0.36)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
          Placeholder
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#111827", letterSpacing: "-0.02em" }}>
          Card 9
        </div>
      </div>

      <div
        style={{
          background: "#fff",
          borderRadius: 12,
          border: "1px dashed rgba(0,0,0,0.18)",
          boxShadow: "0 1px 6px rgba(0,0,0,0.05)",
          padding: 14,
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 700, color: "rgba(0,0,0,0.45)" }}>Platzhalter fuer kommende Card</span>
      </div>
    </section>
  );
}
