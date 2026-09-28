import { BarChart3, Target, LoaderCircle, RefreshCw } from "lucide-react";
import type { BonusEmptyState as EmptyState } from "@/lib/gm-dashboard/bonus-empty-state";

export function BonusEmptyState({
  state,
  kind,
  onRetry,
}: {
  state: EmptyState;
  kind: "categories" | "goal";
  onRetry: () => void;
}) {
  const Icon = state.loading
    ? LoaderCircle
    : kind === "categories"
      ? BarChart3
      : Target;
  return (
    <div
      role="status"
      aria-live={kind === "categories" ? "polite" : "off"}
      aria-busy={Boolean(state.loading)}
      style={{
        minHeight: 236,
        padding: "32px 24px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        textAlign: "center",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 46,
          height: 46,
          borderRadius: 13,
          display: "grid",
          placeItems: "center",
          color: "#9ca3af",
          background: "rgba(15,23,42,0.035)",
          border: "1px solid rgba(15,23,42,0.06)",
        }}
      >
        <Icon
          size={21}
          strokeWidth={1.5}
          className={
            state.loading
              ? "animate-spin motion-reduce:animate-none"
              : undefined
          }
        />
      </span>
      <div style={{ maxWidth: 340 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "#374151",
            lineHeight: 1.5,
          }}
        >
          {state.title}
        </div>
        <p
          style={{
            margin: "6px 0 0",
            fontSize: 11,
            color: "#9ca3af",
            lineHeight: 1.7,
          }}
        >
          {state.description}
        </p>
      </div>
      {state.retry && (
        <button
          type="button"
          onClick={onRetry}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            marginTop: 2,
            padding: "6px 10px",
            borderRadius: 7,
            border: "1px solid rgba(15,23,42,0.1)",
            background: "#fff",
            color: "#374151",
            fontSize: 11,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          <RefreshCw size={12} aria-hidden="true" /> Erneut versuchen
        </button>
      )}
    </div>
  );
}
