"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2, Loader2, LogOut, RotateCw, ShieldCheck } from "lucide-react";
import type { EmployeeAgreementPayload } from "@/lib/api/backend";

type Props = {
  payload: EmployeeAgreementPayload | null;
  fullName: string;
  loading: boolean;
  submitting: boolean;
  checked: boolean;
  error: string | null;
  onChecked: (checked: boolean) => void;
  onAccept: () => void;
  onLogout: () => void;
  onRetry: () => void;
};

export function SmEmployeeAgreement({ payload, fullName, loading, submitting, checked, error, onChecked, onAccept, onLogout, onRetry }: Props) {
  const disabled = loading || submitting || !payload || (!checked && !payload.accepted);
  return (
    <main lang="de" className="min-h-[100dvh] bg-[#f5f5f7] px-[max(16px,env(safe-area-inset-left))] pb-[max(24px,env(safe-area-inset-bottom))] pr-[max(16px,env(safe-area-inset-right))] pt-[max(16px,env(safe-area-inset-top))] text-gray-900 [overflow-wrap:anywhere]" style={{ backgroundImage: "radial-gradient(ellipse at 20% 0%, rgba(220,38,38,.12), transparent 36%)" }}>
      <div className="mx-auto w-full max-w-[460px]">
        <header className="mb-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <span className="text-[10px] font-bold uppercase tracking-[.1em] text-red-600">Coke Spark · SM</span>
            <button type="button" onClick={onLogout} disabled={submitting} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-[9px] border border-black/[.06] bg-white/90 px-3 text-[12px] font-semibold text-gray-600 shadow-sm transition-colors hover:bg-white disabled:opacity-50">
              <LogOut size={14} aria-hidden="true" /> Abmelden
            </button>
          </div>
          <h1 className="text-[26px] font-bold leading-tight tracking-[-.035em] text-gray-900">Datenschutz & Nutzung</h1>
          <p className="mt-2 text-[13px] leading-relaxed text-gray-500">Lies bitte, wie Coke Spark deine SM-Einsätze und Daten verarbeitet. Danach kannst du die App nutzen.</p>
        </header>

        <article className="overflow-hidden rounded-[18px] border border-white bg-white shadow-[0_3px_22px_rgba(0,0,0,.045)]" aria-busy={loading}>
          <div className="border-b border-gray-100 p-5">
            <div className="mb-3 flex flex-wrap items-center gap-2 text-[10px] font-semibold text-gray-500">
              <span className="inline-flex items-center gap-1.5 rounded-md bg-red-50 px-2 py-1 text-red-600"><ShieldCheck size={12} aria-hidden="true" /> Shelf Merchandising</span>
              <span>{payload?.accepted ? "Bereits bestätigt" : "Vor der ersten Nutzung"}</span>
            </div>
            <h2 className="text-[15px] font-bold leading-snug text-gray-900">{payload?.agreement.title ?? "Deine SM-Vereinbarung"}</h2>
            <p className="mt-2 text-[12px] leading-relaxed text-gray-500">{fullName}</p>
            {payload ? <p className="mt-1 text-[10px] text-gray-400">Version {payload.agreement.version}</p> : null}
          </div>

          {loading ? (
            <div className="space-y-6 p-5" role="status" aria-label="SM-Vereinbarung wird geladen">
              <span className="sr-only">Vereinbarung wird geladen.</span>
              {[0, 1, 2].map((index) => <div key={index} aria-hidden="true" className="space-y-2 motion-safe:animate-pulse"><div className="mb-3 h-3 w-2/3 rounded bg-gray-100" /><div className="h-2.5 rounded bg-gray-100" /><div className="h-2.5 rounded bg-gray-100" /><div className="h-2.5 w-4/5 rounded bg-gray-100" /></div>)}
            </div>
          ) : payload ? (
            <div className="divide-y divide-gray-100 px-5">
              {payload.agreement.sections.map((section) => (
                <section key={section.title} className="py-5">
                  <h3 className="text-[14px] font-semibold leading-snug text-gray-900">{section.title}</h3>
                  <div className="mt-2.5 space-y-2.5">
                    {section.body.map((paragraph) => <p key={paragraph} className="text-[13px] font-normal leading-[1.75] text-gray-600">{paragraph}</p>)}
                  </div>
                </section>
              ))}
            </div>
          ) : null}

          {!loading ? (
            <footer className="space-y-4 border-t border-gray-100 bg-gray-50/60 p-5">
              {error ? (
                <div className="rounded-[9px] border border-red-100 bg-red-50 p-3 text-[12px] leading-relaxed text-red-700" role="alert">
                  <p>{error}</p>
                  {!payload ? <button type="button" onClick={onRetry} className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-lg bg-white px-3 font-semibold shadow-sm"><RotateCw size={13} aria-hidden="true" />Erneut laden</button> : null}
                </div>
              ) : null}
              {payload ? (
                <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-[10px] border border-gray-100 bg-white p-3.5">
                  <input type="checkbox" checked={checked} onChange={(event) => onChecked(event.target.checked)} disabled={payload.accepted || submitting} className="mt-0.5 size-5 shrink-0 accent-red-600" />
                  <span className="text-[12px] leading-relaxed text-gray-600">
                    {payload.accepted
                      ? "Du hast diese Version bereits bestätigt."
                      : "Ich habe die Vereinbarung gelesen und akzeptiere die Nutzung von Coke Spark als Arbeits-, Reporting- und Kontrollsystem für meine SM-Einsätze im beschriebenen Umfang."}
                  </span>
                </label>
              ) : null}
              <button type="button" onClick={onAccept} disabled={disabled} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[9px] bg-gradient-to-b from-[#DC2626] to-[#b91c1c] px-3 py-3 text-[12px] font-bold leading-snug text-white shadow-[inset_0_1px_.6px_rgba(255,255,255,.33),inset_0_-1px_0_rgba(255,255,255,.15),0_0_0_1px_#a91b1b,0_1px_6px_rgba(180,20,20,.18)] disabled:bg-none disabled:bg-black/[.06] disabled:text-black/30 disabled:shadow-none">
                {submitting ? <Loader2 size={15} className="shrink-0 motion-safe:animate-spin" aria-hidden="true" /> : <CheckCircle2 size={15} className="shrink-0" aria-hidden="true" />}
                {submitting ? "Wird gespeichert …" : payload?.accepted ? "Zurück zur App" : "Akzeptieren und fortfahren"}
              </button>
              <Link href="/datenschutz/sm" className="flex min-h-11 items-center justify-center gap-2 text-center text-[12px] font-medium leading-relaxed text-gray-500">Vollständige SM-Datenschutzinformation<ArrowRight size={13} className="shrink-0" aria-hidden="true" /></Link>
            </footer>
          ) : null}
        </article>
      </div>
    </main>
  );
}
