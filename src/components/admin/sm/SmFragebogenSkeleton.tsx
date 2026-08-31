/** Mirrors the GM admin FragebogenPageSkeleton without changing the GM page. */
export function SmFragebogenSkeleton() {
  return (
    <div role="status" aria-label="SM-Fragebogen werden geladen" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div aria-hidden="true" style={{ height: 20, width: 360, maxWidth: "100%", borderRadius: 8, background: "rgba(0,0,0,0.06)" }} />
      <div aria-hidden="true" style={{ height: 1, background: "rgba(0,0,0,0.07)" }} />
      <div aria-hidden="true" style={{ borderRadius: 12, background: "#fff", border: "1px solid rgba(0,0,0,0.06)", padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
        {Array.from({ length: 7 }).map((_, index) => (
          <div key={index} style={{ height: 40, borderRadius: 8, background: index % 2 === 0 ? "rgba(0,0,0,0.05)" : "rgba(0,0,0,0.035)" }} />
        ))}
      </div>
    </div>
  );
}
