"use client";

import { useState, useEffect, useCallback } from "react";

interface TimeEntry {
  name: string;
  time: string;
}

interface TimeTrackerProps {
  entries?: TimeEntry[];
}

const defaultEntries: TimeEntry[] = [
  { name: "SPAR Zentrum", time: "08:30 – 09:45" },
  { name: "REWE Nord", time: "10:15 – 11:15" },
  { name: "Hofer Süd", time: "11:45 – 13:15" },
];

function fmt(s: number): string {
  const h = String(Math.floor(s / 3600)).padStart(2, "0");
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const sec = String(s % 60).padStart(2, "0");
  return `${h}:${m}:${sec}`;
}

export function TimeTracker({ entries = defaultEntries }: TimeTrackerProps) {
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [seconds, setSeconds] = useState(5027);

  const active = running && !paused;

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [active]);

  const handleStart = useCallback(() => {
    setRunning(true);
    setPaused(false);
  }, []);

  const handleStop = useCallback(() => {
    setRunning(false);
    setPaused(false);
  }, []);

  const handlePause = useCallback(() => {
    setPaused((p) => !p);
  }, []);

  return (
    <div
      style={{
        backgroundColor: "#ffffff",
        borderRadius: 14,
        boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
        padding: "20px",
        height: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        className="flex-1 flex flex-col items-center justify-center"
        style={{ minHeight: 0 }}
      >
        <span
          style={{
            fontSize: 32,
            fontWeight: 700,
            color: "#DC2626",
            letterSpacing: "0.06em",
            lineHeight: 1,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {fmt(seconds)}
        </span>

        <div
          className="flex items-center gap-1.5 mt-2"
          style={{ color: active ? "#ef4444" : "rgba(239,68,68,0.5)" }}
        >
          <div
            style={{
              width: 5,
              height: 5,
              borderRadius: "50%",
              backgroundColor: "currentColor",
            }}
          />
          <span style={{ fontSize: 8, fontWeight: 600, letterSpacing: "0.1em" }}>
            {active ? "RECORDING" : paused ? "PAUSED" : "STOPPED"}
          </span>
        </div>
      </div>

      <div
        className="mt-4"
        style={{
          height: 1,
          background: "linear-gradient(90deg, transparent, rgba(0,0,0,0.08) 50%, transparent)",
        }}
      />

      <div className="mt-3 space-y-1.5">
        {entries.map((e, i) => (
          <div
            key={i}
            className="flex items-center justify-between"
            style={{
              backgroundColor: "rgba(0,0,0,0.03)",
              borderRadius: 7,
              padding: "7px 10px",
            }}
          >
            <div className="flex items-center gap-2">
              <div
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: "50%",
                  backgroundColor: "#DC2626",
                  opacity: 0.6 + i * 0.15,
                }}
              />
              <span
                style={{
                  fontSize: 10,
                  color: "rgba(0,0,0,0.45)",
                  fontWeight: 500,
                }}
              >
                {e.name}
              </span>
            </div>
            <span
              style={{
                fontSize: 10,
                color: "#ef4444",
                fontWeight: 600,
                letterSpacing: "0.02em",
              }}
            >
              {e.time}
            </span>
          </div>
        ))}
      </div>

      {running ? (
        <div className="flex gap-2" style={{ marginTop: 14 }}>
          <button
            onClick={handleStop}
            style={{
              flex: 1,
              padding: "6px 0",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.02em",
              color: "#ffffff",
              background: "linear-gradient(to bottom, #DC2626, #e84040)",
              border: "none",
              borderRadius: 7,
              cursor: "pointer",
              transition: "all 0.15s ease",
              boxShadow:
                "inset 0 1px 0.6px rgba(255,255,255,0.33), inset 0 -1px 0 rgba(255,255,255,0.15), 0 0 0 1px #c42020, 0 1px 6px rgba(180,20,20,0.14)",
            }}
          >
            STOP
          </button>
          <button
            onClick={handlePause}
            style={{
              flex: 1,
              padding: "6px 0",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.02em",
              color: "#ffffff",
              background: paused
                ? "linear-gradient(to bottom, #059669, #0cb880)"
                : "linear-gradient(to bottom, #ea580c, #f0722e)",
              border: "none",
              borderRadius: 7,
              cursor: "pointer",
              transition: "all 0.15s ease",
              boxShadow: paused
                ? "inset 0 1px 0.6px rgba(255,255,255,0.33), inset 0 -1px 0 rgba(255,255,255,0.15), 0 0 0 1px #048560, 0 1px 6px rgba(5,80,50,0.14)"
                : "inset 0 1px 0.6px rgba(255,255,255,0.33), inset 0 -1px 0 rgba(255,255,255,0.15), 0 0 0 1px #d4500b, 0 1px 6px rgba(180,60,8,0.14)",
            }}
          >
            {paused ? "RESUME" : "PAUSE"}
          </button>
        </div>
      ) : (
        <button
          onClick={handleStart}
          style={{
            marginTop: 14,
            width: "100%",
            padding: "6px 0",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.02em",
            color: "#ffffff",
            background: "linear-gradient(to bottom, #059669, #0cb880)",
            border: "none",
            borderRadius: 7,
            cursor: "pointer",
            transition: "all 0.15s ease",
            boxShadow:
              "inset 0 1px 0.6px rgba(255,255,255,0.33), inset 0 -1px 0 rgba(255,255,255,0.15), 0 0 0 1px #048560, 0 1px 6px rgba(5,80,50,0.14)",
          }}
        >
          START
        </button>
      )}
    </div>
  );
}
