"use client";

import { Check, X } from "lucide-react";
import { SINGLE_CHOICE_AVAILABILITY_TYPES, type SingleChoiceAvailabilityType } from "@/types/fragebogen";

type AvailabilityTypeModalProps = {
  open: boolean;
  accentColor: string;
  selectedType: SingleChoiceAvailabilityType | null;
  onSelect: (value: SingleChoiceAvailabilityType) => void;
  onCancel: () => void;
  onConfirm: () => void;
};

export function AvailabilityTypeModal({
  open,
  accentColor,
  selectedType,
  onSelect,
  onCancel,
  onConfirm,
}: AvailabilityTypeModalProps) {
  if (!open) return null;

  return (
    <div
      onClick={onCancel}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 320,
        backgroundColor: "rgba(0,0,0,0.38)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          width: "min(520px, 100%)",
          backgroundColor: "#fff",
          borderRadius: 14,
          border: "1px solid rgba(0,0,0,0.08)",
          boxShadow: "0 16px 48px rgba(0,0,0,0.24), 0 2px 8px rgba(0,0,0,0.08)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: 54,
            padding: "0 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid rgba(0,0,0,0.07)",
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>
            Verfügbarkeits-Typ wählen
          </div>
          <button
            type="button"
            onClick={onCancel}
            style={{
              width: 24,
              height: 24,
              borderRadius: 6,
              border: "none",
              backgroundColor: "rgba(0,0,0,0.04)",
              color: "rgba(0,0,0,0.42)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <X size={13} strokeWidth={2.5} />
          </button>
        </div>

        <div style={{ padding: "14px 16px 12px" }}>
          <div
            style={{
              display: "grid",
              gap: 8,
              gridTemplateColumns: "repeat(auto-fill, minmax(146px, 1fr))",
            }}
          >
            {SINGLE_CHOICE_AVAILABILITY_TYPES.map((type) => {
              const selected = selectedType === type;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => onSelect(type)}
                  style={{
                    height: 38,
                    borderRadius: 8,
                    border: selected ? "none" : "1px solid rgba(0,0,0,0.09)",
                    background: selected
                      ? `linear-gradient(180deg, ${accentColor}, ${accentColor})`
                      : "#fff",
                    boxShadow: selected
                      ? "inset 0 1px 0 rgba(255,255,255,0.28), 0 1px 5px rgba(0,0,0,0.16)"
                      : "none",
                    color: selected ? "#fff" : "#374151",
                    cursor: "pointer",
                    fontSize: 11,
                    fontWeight: selected ? 700 : 600,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                  }}
                >
                  {selected && <Check size={12} strokeWidth={2.5} />}
                  {type}
                </button>
              );
            })}
          </div>
          <div style={{ marginTop: 14, fontSize: 11, color: "rgba(0,0,0,0.45)" }}>
            Der Typ wird zusammen mit der Verfügbarkeitsabfrage gespeichert.
          </div>
        </div>

        <div
          style={{
            borderTop: "1px solid rgba(0,0,0,0.07)",
            padding: "10px 16px",
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
          }}
        >
          <button
            type="button"
            onClick={onCancel}
            style={{
              height: 32,
              padding: "0 12px",
              borderRadius: 7,
              border: "1px solid rgba(0,0,0,0.1)",
              backgroundColor: "#fff",
              color: "#374151",
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Abbrechen
          </button>
          <button
            type="button"
            disabled={!selectedType}
            onClick={onConfirm}
            style={{
              height: 32,
              padding: "0 14px",
              borderRadius: 7,
              border: "none",
              backgroundColor: selectedType ? accentColor : "rgba(0,0,0,0.12)",
              color: "#fff",
              fontSize: 11,
              fontWeight: 700,
              cursor: selectedType ? "pointer" : "not-allowed",
            }}
          >
            Übernehmen
          </button>
        </div>
      </div>
    </div>
  );
}
