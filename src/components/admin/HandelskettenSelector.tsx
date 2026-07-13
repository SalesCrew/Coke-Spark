"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

import type { Question } from "@/types/fragebogen";

interface HandelskettenSelectorProps {
  question: Question;
  availableChains: string[];
  onUpdate: (question: Question) => void;
  accentColor?: string;
  accentBackground?: string;
}

export function HandelskettenSelector({
  question,
  availableChains,
  onUpdate,
  accentColor = "#2563eb",
  accentBackground = "rgba(37,99,235,0.09)",
}: HandelskettenSelectorProps) {
  const [open, setOpen] = useState(false);
  const chainOptions = Array.from(
    new Set(
      availableChains
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0),
    ),
  );
  const allChainsActive = question.chains === undefined;
  const selectedChains = question.chains;
  const hasRestriction = selectedChains !== undefined;

  const toggleAllChains = () => {
    if (chainOptions.length === 0) {
      onUpdate({ ...question, chains: undefined });
      return;
    }
    if (allChainsActive) {
      onUpdate({ ...question, chains: [...chainOptions] });
    } else {
      onUpdate({ ...question, chains: undefined });
    }
    setOpen(!allChainsActive);
  };

  const toggleChain = (chain: string) => {
    const current = question.chains ?? [...chainOptions];
    const next = current.includes(chain)
      ? current.filter((entry) => entry !== chain)
      : [...current, chain];
    onUpdate({
      ...question,
      chains: next.length === chainOptions.length ? undefined : next,
    });
  };

  return (
    <div style={{ marginTop: 14 }}>
      <button
        type="button"
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((current) => !current);
        }}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 7,
          width: "100%",
          padding: "8px 0 6px",
          fontSize: 11,
          fontWeight: 600,
          color: hasRestriction ? accentColor : "rgba(0,0,0,0.35)",
          background: "none",
          border: "none",
          borderTop: "1px solid rgba(0,0,0,0.04)",
          cursor: "pointer",
        }}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
          <rect x="1" y="1" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.3" />
          <rect x="6.5" y="1" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.3" />
          <rect x="1" y="6.5" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.3" />
          <rect x="6.5" y="6.5" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.3" />
        </svg>
        <span style={{ flex: 1, textAlign: "left" }}>Handelsketten</span>
        {hasRestriction ? (
          <span
            style={{
              padding: "1px 7px",
              borderRadius: 10,
              backgroundColor: accentBackground,
              color: accentColor,
              fontSize: 9,
              fontWeight: 700,
            }}
          >
            {selectedChains.length} ausgewählt
          </span>
        ) : null}
        <ChevronDown
          size={12}
          strokeWidth={2}
          style={{
            flexShrink: 0,
            transform: open ? "rotate(180deg)" : "rotate(0)",
            transition: "transform 0.2s ease",
          }}
        />
      </button>

      <div
        style={{
          maxHeight: open ? 400 : 0,
          opacity: open ? 1 : 0,
          overflow: "hidden",
          transition: "max-height 0.3s cubic-bezier(0.4,0,0.2,1), opacity 0.2s ease",
        }}
      >
        <div style={{ paddingTop: 10, paddingBottom: 4 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 500, color: "#374151" }}>Alle Handelsketten</span>
            <button
              type="button"
              role="switch"
              aria-label="Alle Handelsketten"
              aria-checked={allChainsActive}
              onClick={(event) => {
                event.stopPropagation();
                toggleAllChains();
              }}
              style={{
                width: 32,
                height: 18,
                borderRadius: 9,
                backgroundColor: allChainsActive ? accentColor : "rgba(0,0,0,0.12)",
                border: "none",
                cursor: "pointer",
                position: "relative",
                transition: "background-color 0.2s ease",
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: "50%",
                  backgroundColor: "#fff",
                  position: "absolute",
                  top: 2,
                  left: allChainsActive ? 16 : 2,
                  boxShadow: "0 1px 3px rgba(0,0,0,0.18)",
                  transition: "left 0.2s ease",
                }}
              />
            </button>
          </div>

          {!allChainsActive ? (
            <>
              <div
                style={{
                  marginBottom: 7,
                  color: "rgba(0,0,0,0.3)",
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: "0.07em",
                  textTransform: "uppercase",
                }}
              >
                Ketten auswählen
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {chainOptions.map((chain) => {
                  const isSelected = selectedChains?.includes(chain) ?? true;
                  return (
                    <button
                      key={chain}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleChain(chain);
                      }}
                      style={{
                        padding: "3px 10px",
                        borderRadius: 5,
                        border: "none",
                        background: isSelected ? accentBackground : "rgba(0,0,0,0.04)",
                        color: isSelected ? accentColor : "rgba(0,0,0,0.38)",
                        boxShadow: isSelected ? `inset 0 0 0 1px ${accentColor}40` : "none",
                        cursor: "pointer",
                        fontFamily: "inherit",
                        fontSize: 10,
                        fontWeight: 600,
                        transition: "all 0.12s ease",
                      }}
                    >
                      {chain}
                    </button>
                  );
                })}
              </div>
              {chainOptions.length === 0 ? (
                <div style={{ marginTop: 8, fontSize: 10, color: "rgba(0,0,0,0.45)", fontWeight: 500 }}>
                  Keine Handelsketten aus Märkten verfügbar.
                </div>
              ) : null}
              {selectedChains?.length === 0 ? (
                <div style={{ marginTop: 8, fontSize: 10, color: "#DC2626", fontWeight: 500 }}>
                  Keine Kette ausgewählt – Frage wird für niemanden angezeigt.
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
