"use client";

import { useState } from "react";
import { ManagementWorkspace } from "@/components/admin/sm/SmFbManagementWorkspace";
import { BackendApiError } from "@/lib/api/backend";
import type { SmManagementApi, SmManagementQuery } from "@/types/smManagement";

// Opt-in development route only. No authentication/session state or production API is used.
const origin = "http://127.0.0.1:4017";
const currentOwner = () => "isolated-preview";
async function localRequest(path: string, body?: unknown) {
  const response = await fetch(`${origin}${path}`, { method: body ? "POST" : "GET", cache: "no-store",
    headers: { "Content-Type": "application/json", "x-local-role": "sm_admin" }, body: body ? JSON.stringify(body) : undefined });
  const data = await response.json();
  if (!response.ok) throw new BackendApiError(data.error ?? "Lokaler Testfehler", response.status, data.code, data);
  return data;
}
const api: SmManagementApi = {
  list: (query: SmManagementQuery) => localRequest(`/completed?${new URLSearchParams(Object.entries(query).map(([key, value]) => [key, String(value)]))}`),
  detail: id => localRequest(`/completed/${id}`),
  history: (id, question, cursor) => localRequest(`/completed/${id}/history?questionId=${question}${cursor ? `&cursorVersion=${cursor}` : ""}`),
  correct: (id, input) => localRequest(`/completed/${id}/corrections`, input),
  upload: async (id, questionId, file) => {
    const prepared = await localRequest(`/completed/${id}/photos/upload-url`, { questionId, originalFileName: file.name, mimeType: file.type, byteSize: file.size });
    const response = await fetch(prepared.upload.signedUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
    if (!response.ok) throw new Error("Lokaler Foto-Upload fehlgeschlagen.");
    return prepared.receipt;
  },
};

export default function Preview() {
  const [summary, setSummary] = useState<unknown>(null);
  return <main style={{ background: "#f5f5f7", minHeight: "100dvh", padding: 24 }}>
    <h1 style={{ fontSize: 20, fontWeight: 700 }}>SM · Fragebogen-Management · isolierter Test</h1>
    <p style={{ fontSize: 12, margin: "8px 0 20px", color: "#777" }}>Echte UI → lokale Express-Routen → PGlite. Keine Produktionsdaten und keine echte Anmeldung.</p>
    <ManagementWorkspace api={api} owner="isolated-preview" currentOwner={currentOwner} />
    <button style={{ marginTop: 20, fontSize: 12 }} onClick={() => void localRequest("/fixture-state").then(setSummary)}>Datenbank und OOS nachladen</button>
    {summary ? <pre style={{ fontSize: 11, whiteSpace: "pre-wrap" }}>{JSON.stringify(summary, null, 2)}</pre> : null}
  </main>;
}
