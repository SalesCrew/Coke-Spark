"use client";

export type ClientTelemetryResult = "success" | "failure" | "rejected" | "started" | "cancelled" | "skipped";

export type ClientTelemetryEvent = {
  event: string;
  action: string;
  result: ClientTelemetryResult;
  statusCode?: number;
  durationMs?: number;
  details?: Record<string, unknown>;
};

const MAX_DEPTH = 4;
const MAX_STRING_LENGTH = 400;
const DEDUPE_WINDOW_MS = 2_500;
const recentEventByKey = new Map<string, number>();

function sanitizeText(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) return "";
  return trimmed.length > MAX_STRING_LENGTH ? `${trimmed.slice(0, MAX_STRING_LENGTH)}...` : trimmed;
}

function sanitizeValue(value: unknown, depth = 0): unknown {
  if (value == null) return value;
  if (depth >= MAX_DEPTH) return "[truncated]";
  if (typeof value === "string") return sanitizeText(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((entry) => sanitizeValue(entry, depth + 1));
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).slice(0, 30);
    const output: Record<string, unknown> = {};
    for (const [key, entryValue] of entries) {
      output[key] = sanitizeValue(entryValue, depth + 1);
    }
    return output;
  }
  return String(value);
}

function buildDedupeKey(input: ClientTelemetryEvent): string {
  const statusCode = Number.isFinite(input.statusCode ?? NaN) ? String(input.statusCode) : "-";
  return `${input.event}|${input.action}|${input.result}|${statusCode}`;
}

export function emitClientTelemetry(input: {
  backendUrl: string;
  accessToken: string | null;
  event: ClientTelemetryEvent;
}): void {
  const backendUrl = input.backendUrl.trim().replace(/\/+$/, "");
  const accessToken = input.accessToken?.trim() ?? "";
  if (!backendUrl || !accessToken) return;

  const eventName = sanitizeText(input.event.event);
  const action = sanitizeText(input.event.action);
  if (!eventName || !action) return;

  const dedupeKey = buildDedupeKey({
    ...input.event,
    event: eventName,
    action,
  });
  const now = Date.now();
  const previous = recentEventByKey.get(dedupeKey);
  if (previous && now - previous < DEDUPE_WINDOW_MS) {
    return;
  }
  recentEventByKey.set(dedupeKey, now);

  const payload = {
    event: eventName,
    action,
    result: input.event.result,
    ...(Number.isFinite(input.event.statusCode ?? NaN) ? { statusCode: Number(input.event.statusCode) } : {}),
    ...(Number.isFinite(input.event.durationMs ?? NaN) ? { durationMs: Number(input.event.durationMs) } : {}),
    ...(input.event.details ? { details: sanitizeValue(input.event.details) } : {}),
  };

  void fetch(`${backendUrl}/telemetry/events`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {
    // Telemetry must never break user flows.
  });
}
