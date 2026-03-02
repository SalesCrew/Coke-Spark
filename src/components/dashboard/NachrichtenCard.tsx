"use client";

import { useState } from "react";

interface Message {
  subject: string;
  date: string;
  from: string;
  body: string;
}

interface NachrichtenCardProps {
  message?: Message;
}

const defaultMessage: Message = {
  subject: "Schulung am Montag",
  date: "24.02.2026",
  from: "Isabella Schuster",
  body: "Am Montag findet um 10:00 eine Online-Schulung zu den neuen Produkten statt. Teilnahme ist verpflichtend.",
};

export function NachrichtenCard({
  message = defaultMessage,
}: NachrichtenCardProps) {
  const [read, setRead] = useState(false);

  return (
    <div
      style={{
        backgroundColor: "#ffffff",
        borderRadius: 14,
        border: "1px solid rgba(0,0,0,0.08)",
        boxShadow: "0 2px 8px rgba(0,0,0,0.025)",
        padding: "16px 18px 14px",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          {!read && (
            <div
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                backgroundColor: "#DC2626",
                shrink: 0,
              }}
            />
          )}
          <span className="text-[12px] font-semibold text-gray-800">
            {message.subject}
          </span>
        </div>
        <span className="text-[10px] tabular-nums text-gray-400 shrink-0">
          {message.date}
        </span>
      </div>

      <div style={{ marginTop: 4, paddingLeft: !read ? 15 : 0 }}>
        <span className="text-[10px] text-gray-400">
          Von: {message.from}
        </span>
      </div>

      <p
        className="text-[11px] text-gray-600 leading-relaxed"
        style={{ marginTop: 10, paddingLeft: !read ? 15 : 0 }}
      >
        {message.body}
      </p>

      <div
        className="flex items-center justify-between"
        style={{ marginTop: 14 }}
      >
        <span
          className="text-[9px] font-medium uppercase tracking-[0.04em]"
          style={{ color: read ? "rgba(0,0,0,0.25)" : "rgba(220,38,38,0.5)" }}
        >
          {read ? "Gelesen" : "Ungelesen"}
        </span>

        {!read && (
          <button
            onClick={() => setRead(true)}
            style={{
              padding: "4px 12px",
              fontSize: 10,
              fontWeight: 600,
              color: "#DC2626",
              backgroundColor: "rgba(220,38,38,0.06)",
              border: "1px solid rgba(220,38,38,0.12)",
              borderRadius: 7,
              cursor: "pointer",
              transition: "all 0.15s ease",
              letterSpacing: "0.01em",
            }}
          >
            Als gelesen markieren
          </button>
        )}
      </div>
    </div>
  );
}
