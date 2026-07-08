"use client";

import type { CSSProperties } from "react";

const baseSkeletonStyle: CSSProperties = {
  background: "linear-gradient(90deg, rgba(15,23,42,0.045), rgba(15,23,42,0.075), rgba(15,23,42,0.045))",
  border: "1px solid rgba(15,23,42,0.035)",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.42)",
};

export function GmSkeletonBlock({ style }: { style?: CSSProperties }) {
  return (
    <div
      aria-hidden="true"
      style={{
        ...baseSkeletonStyle,
        borderRadius: 8,
        ...style,
      }}
    />
  );
}

export function GmSkeletonMarketRows({ count = 5 }: { count?: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7, padding: "2px 0" }} aria-hidden="true">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={`gm-skeleton-market-${index}`}
          style={{
            display: "grid",
            gridTemplateColumns: "42px 1fr 52px",
            alignItems: "center",
            gap: 9,
            padding: "8px 8px",
            borderRadius: 8,
            background: "rgba(255,255,255,0.62)",
            border: "1px solid rgba(15,23,42,0.035)",
          }}
        >
          <GmSkeletonBlock style={{ width: 34, height: 16, borderRadius: 5 }} />
          <div style={{ minWidth: 0 }}>
            <GmSkeletonBlock style={{ width: `${66 - (index % 3) * 9}%`, height: 9, borderRadius: 99 }} />
            <GmSkeletonBlock style={{ width: `${48 + (index % 2) * 12}%`, height: 7, borderRadius: 99, marginTop: 5, opacity: 0.72 }} />
          </div>
          <GmSkeletonBlock style={{ width: 34, height: 12, borderRadius: 99, justifySelf: "end" }} />
        </div>
      ))}
    </div>
  );
}

export function GmSkeletonTimelineRows({ count = 3 }: { count?: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }} aria-hidden="true">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={`gm-skeleton-timeline-${index}`}
          style={{
            display: "grid",
            gridTemplateColumns: "10px 60px 1fr 46px",
            alignItems: "center",
            gap: 8,
            padding: "7px 10px",
            borderRadius: 7,
            background: "rgba(0,0,0,0.026)",
          }}
        >
          <GmSkeletonBlock style={{ width: 5, height: 5, borderRadius: 99 }} />
          <GmSkeletonBlock style={{ width: 46, height: 8, borderRadius: 99 }} />
          <GmSkeletonBlock style={{ width: `${52 + index * 12}%`, height: 9, borderRadius: 99 }} />
          <GmSkeletonBlock style={{ width: 40, height: 8, borderRadius: 99 }} />
        </div>
      ))}
    </div>
  );
}
