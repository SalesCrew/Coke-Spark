"use client";
import { readActiveAuthSession } from "@/lib/auth/sessionRegistry";
import { emitClientTelemetry } from "@/lib/clientTelemetry";
import { briefingPdfFailure } from "./briefingPdf";

export function reportBriefingPdfFailure(
  stage: "document" | "page" | "render" | "text", error: unknown,
  dimensions: { attempt?: number; width?: number; height?: number } = {},
) {
  emitClientTelemetry({
    backendUrl: process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000",
    accessToken: readActiveAuthSession()?.session.accessToken ?? null,
    event: {
      event: "gm_briefing_pdf_error", action: `pdf_${stage}`, result: "failure",
      details: { stage, ...briefingPdfFailure(error), ...dimensions },
    },
  });
}
