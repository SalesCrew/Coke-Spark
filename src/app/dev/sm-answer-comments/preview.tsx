"use client";

import { useState } from "react";
import { SmCommentTriggerEditor, reconcileCommentOptions } from "@/components/admin/sm/SmCommentTriggerEditor";
import { QuestionCard } from "@/components/sm/SmVisitWorkspace";
import type { SmQuestion } from "@/types/smQuestionnaire";
import type { SmVisitAnswer, SmVisitQuestion } from "@/types/smVisit";

export default function Preview() {
  const [question, setQuestion] = useState<SmQuestion>({ id: "local-preview", type: "single", text: "Konnte die Zweitplatzierung vollständig aufgebaut werden?", required: true, options: ["Ja, vollständig", "Teilweise", "Bereits vorhanden", "Nein"], config: { options: ["Ja, vollständig", "Teilweise", "Bereits vorhanden", "Nein"], commentTrigger: { mode: "options", optionCodes: ["option_4"] } }, rules: [] });
  const [answer, setAnswer] = useState<SmVisitAnswer>({ kind: "empty" });
  const [step, setStep] = useState(false);
  const visit: SmVisitQuestion = { ...question, questionCode: question.id, options: question.options.map((label, index) => ({ code: `option_${index + 1}`, label })), applicable: true, applicabilityReason: null };
  return <main className="min-h-dvh bg-[#f5f5f7] p-5 text-[#1a1a1a]">
    <div className="mx-auto max-w-3xl">
      <h1 className="text-lg font-semibold">SM · Antwortkommentare</h1>
      <p className="mb-5 mt-1 text-xs text-black/40">Lokale Vorschau mit echten UI-Komponenten. Keine Datenbankänderungen.</p>
      <div className="grid items-start gap-5 md:grid-cols-2">
        <section className="rounded-2xl border border-black/5 bg-white p-4">
          <h2 className="text-xs font-semibold">Admin · Kommentar-Auslöser</h2>
          <SmCommentTriggerEditor question={question} onUpdate={(next) => { setQuestion(next); setAnswer({ kind: "empty" }); setStep(false); }} />
          <p className="mb-2 mt-5 text-[10px] text-black/40">Optionen umbenennen / entfernen</p>
          {question.options.map((label, index) => <div key={index} className="mb-2 flex gap-2">
            <input aria-label={`Option ${index + 1}`} value={label} onChange={(event) => { const options = question.options.map((old, i) => i === index ? event.target.value : old); setQuestion({ ...question, options, config: reconcileCommentOptions(question, { ...question.config, options }) }); setAnswer({ kind: "empty" }); }} className="min-w-0 flex-1 rounded border border-black/10 px-2 py-1 text-xs" />
            <button type="button" aria-label={`Option ${index + 1} entfernen`} onClick={() => { const options = question.options.filter((_, i) => i !== index); setQuestion({ ...question, options, config: reconcileCommentOptions(question, { ...question.config, options }, index) }); setAnswer({ kind: "empty" }); }} className="text-xs text-black/30">×</button>
          </div>)}
        </section>
        <section className="mx-auto w-full max-w-[390px]">
          {step ? <div className="rounded-2xl bg-white p-5 text-sm"><p>Antwort vollständig. Weiter funktioniert.</p><button type="button" onClick={() => setStep(false)} className="mt-3 text-xs text-red-600">Zur Antwort</button></div> : <QuestionCard question={visit} answer={answer} onAnswer={setAnswer} saveState="local" saveError={null} photoFiles={[]} photoBusy={false} onPhotoUpload={() => {}} onPhotoDelete={() => {}} questionNumber={1} questionCount={2} previousDisabled={true} nextLabel="Weiter" onPrevious={() => {}} onNext={() => { if (answer.kind !== "empty") setStep(true); }} />}
        </section>
      </div>
    </div>
  </main>;
}
