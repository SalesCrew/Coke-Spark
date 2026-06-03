"use client";

function polarToCartesian(cx: number, cy: number, radius: number, angleDeg: number): { x: number; y: number } {
  const angleRad = (angleDeg * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(angleRad),
    y: cy + radius * Math.sin(angleRad),
  };
}

function describeDonutSegment(cx: number, cy: number, outerRadius: number, innerRadius: number, startAngle: number, endAngle: number): string {
  const outerStart = polarToCartesian(cx, cy, outerRadius, startAngle);
  const outerEnd = polarToCartesian(cx, cy, outerRadius, endAngle);
  const innerStart = polarToCartesian(cx, cy, innerRadius, startAngle);
  const innerEnd = polarToCartesian(cx, cy, innerRadius, endAngle);
  const largeArcFlag = Math.abs(endAngle - startAngle) > 180 ? 1 : 0;
  const outerSweepFlag = endAngle > startAngle ? 1 : 0;
  const innerSweepFlag = outerSweepFlag === 1 ? 0 : 1;

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} ${outerSweepFlag} ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} ${innerSweepFlag} ${innerStart.x} ${innerStart.y}`,
    "Z",
  ].join(" ");
}

export function PlaceholderCardNine() {
  const standartShare = 63;
  const flexShare = 37;
  const totalVisits = 138;
  const standartVisits = 87;
  const flexVisits = 51;
  const gaugeStart = 180;
  const gaugeEnd = 360;
  const splitAngle = gaugeStart + (gaugeEnd - gaugeStart) * (standartShare / 100);
  const segmentGap = 4;
  const leftEnd = Math.max(gaugeStart, splitAngle - segmentGap / 2);
  const rightStart = Math.min(gaugeEnd, splitAngle + segmentGap / 2);

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
        gap: 0,
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 12,
          border: "1px solid rgba(0,0,0,0.06)",
          boxShadow: "0 1px 6px rgba(0,0,0,0.05)",
          padding: "10px 14px 12px",
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "flex-start",
            alignItems: "center",
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(100,116,139,0.75)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Verteilung
          </div>
        </div>

        <div style={{ position: "relative", display: "flex", justifyContent: "center", marginTop: 0, width: "100%", maxWidth: 360 }}>
          <svg viewBox="0 0 360 160" width="100%" height={160} style={{ display: "block" }}>
            <path
              d={describeDonutSegment(180, 146, 123, 93, gaugeStart, leftEnd)}
              fill="rgba(239,68,68,0.14)"
              stroke="#ef4444"
              strokeWidth={2}
            />
            <path
              d={describeDonutSegment(180, 146, 123, 93, rightStart, gaugeEnd)}
              fill="rgba(239,68,68,0.08)"
              stroke="#ef4444"
              strokeWidth={2}
            />
          </svg>
          <div
            style={{
              position: "absolute",
              left: "50%",
              bottom: 46,
              transform: "translateX(-50%)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 2,
              pointerEvents: "none",
            }}
          >
            <span
              style={{
                fontSize: 34,
                fontWeight: 800,
                lineHeight: 1,
                background: "linear-gradient(135deg, #B91C1C 0%, #DC2626 62%, #EF4444 100%)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                WebkitTextFillColor: "transparent",
                color: "transparent",
              }}
            >
              {totalVisits}
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(0,0,0,0.34)", letterSpacing: "0.18em", textTransform: "uppercase" }}>
              Gesamt
            </span>
          </div>
        </div>

        <div style={{ borderTop: "1px solid rgba(0,0,0,0.06)", marginTop: 0 }}>
          <div
            style={{
              borderBottom: "1px solid rgba(0,0,0,0.06)",
              padding: "10px 2px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: "#ef4444", display: "inline-block" }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: "#111827" }}>Standart Visit</span>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: "#111111", lineHeight: 1 }}>{standartShare.toFixed(1).replace(".", ",")}%</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(100,116,139,0.62)", marginTop: 2 }}>{standartVisits} Fälle</div>
            </div>
          </div>

          <div
            style={{
              padding: "10px 2px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: "rgba(220,38,38,0.45)", display: "inline-block" }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: "#111827" }}>Flex Visit</span>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: "#111111", lineHeight: 1 }}>{flexShare.toFixed(1).replace(".", ",")}%</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(100,116,139,0.62)", marginTop: 2 }}>{flexVisits} Fälle</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
