"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { SM_COMMENT_MAX_LENGTH } from "@/lib/sm/answerComments";

export function SmAnswerCommentDialog({ questionText, value, onChange, onClose, onSave }: {
  questionText: string; value: string; onChange: (value: string) => void; onClose: () => void; onSave: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => { dialog?.close(); previousFocus?.focus(); };
  }, []);
  return createPortal(<dialog ref={dialogRef} aria-labelledby="sm-answer-comment-title" onCancel={(event) => { event.preventDefault(); onClose(); }} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
    className="fixed inset-0 m-auto max-h-[calc(100dvh-40px)] w-[calc(100%-40px)] max-w-[360px] overflow-y-auto rounded-2xl border-0 bg-white/[0.98] p-0 text-[#1a1a1a] shadow-[0_8px_40px_rgba(0,0,0,.12),0_2px_8px_rgba(0,0,0,.06)] backdrop:bg-black/[0.18] backdrop:backdrop-blur-[6px]">
    <div className="flex items-center gap-2 border-b border-black/[0.05] bg-black/[0.03] px-4 py-2.5">
      <h2 id="sm-answer-comment-title" className="flex-1 text-[9px] font-bold uppercase tracking-[.07em] text-black/40">Kommentar <span className="ml-1 text-red-500">*</span></h2>
      <button type="button" aria-label="Kommentar schließen" onClick={onClose} className="flex h-6 w-6 items-center justify-center rounded-md text-black/35 hover:bg-black/5"><X size={13} /></button>
    </div>
    <div className="bg-white px-4 py-3">
      <p className="mb-2 line-clamp-2 text-[10px] font-medium leading-relaxed text-black/40">{questionText}</p>
      <textarea autoFocus aria-label="Kommentar zur Antwort" required value={value} onChange={(event) => onChange(event.target.value)} placeholder="Bitte erläutere deine Antwort …" maxLength={SM_COMMENT_MAX_LENGTH} rows={4}
        className="block min-h-20 w-full resize-none border-0 bg-white p-0 text-[16px] leading-relaxed text-[#1a1a1a] outline-none placeholder:text-black/25 sm:text-[12px]" />
      <div className="mt-1 flex justify-between text-[8px] text-black/30"><span>Für diese Antwort erforderlich</span><span>{value.length}/{SM_COMMENT_MAX_LENGTH}</span></div>
    </div>
    <div className="flex gap-[7px] border-t border-black/[0.05] bg-black/[0.03] p-2.5">
      <button type="button" onClick={onClose} className="h-8 flex-1 rounded-lg bg-white text-[11px] font-semibold text-black/40 shadow-[0_1px_3px_rgba(0,0,0,.07),inset_0_0_0_1px_rgba(0,0,0,.06)]">Zurück</button>
      <button type="button" disabled={!value.trim()} onClick={onSave} className="h-8 flex-1 rounded-lg bg-gradient-to-b from-[#059669] to-[#0cb880] text-[11px] font-bold text-white shadow-[inset_0_1px_.6px_rgba(255,255,255,.28),0_0_0_1px_#04856080,0_2px_8px_rgba(5,150,105,.25)] disabled:bg-none disabled:bg-black/[0.08] disabled:text-black/25 disabled:shadow-none">Übernehmen</button>
    </div>
  </dialog>, document.body);
}
