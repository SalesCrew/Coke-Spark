"use client";

import { useId, useRef } from "react";
import { Camera, MessageSquare, X } from "lucide-react";
import { smCommentTriggerKey } from "@/lib/sm/answerComments";
import { smManagementAnswerLabel, smManagementNextAnswer, smManagementMatrixLabels, smManagementSelectMatrix, smManagementOptionSubheadings, smManagementConfigNumber } from "@/lib/sm/management";
import type { SmManagedQuestion, SmManagementPhoto } from "@/types/smManagement";
import type { SmVisitAnswer } from "@/types/smVisit";
import styles from "./SmFbManagementWorkspace.module.css";

function textArray(value: unknown): string[] { return Array.isArray(value) ? value.map(item => typeof item === "string" ? item : "") : []; }

export function SmManagementAnswer({ question, value, editable, disabled, photos, onChange, onUpload }: {
  question: SmManagedQuestion; value: SmVisitAnswer; editable: boolean; disabled: boolean; photos: SmManagementPhoto[];
  onChange: (answer: SmVisitAnswer) => void; onUpload: (files: File[]) => void;
}) {
  const inputId = useId(), fileRef = useRef<HTMLInputElement>(null);
  const update = (next: SmVisitAnswer) => onChange(smManagementNextAnswer(question, value, next));
  const subheadings = smManagementOptionSubheadings(question);
  const commentEnabled = Boolean(smCommentTriggerKey(question, value));
  const comment = value.kind !== "empty" ? value.comment ?? "" : "";
  if (!editable) return <div className={styles.answerRead}>
    <p>{question.answerState === "not_applicable" ? "Nicht zutreffend · " : ""}{smManagementAnswerLabel(question, value)}</p>
    {comment ? <div className={styles.commentRead}><MessageSquare size={12} /><span>{comment}</span></div> : null}
    {question.type === "photo" ? <SmManagementPhotos photos={photos} /> : null}
  </div>;

  const selection = value.kind === "choice" || value.kind === "yesnomulti" ? [value.optionCode] : value.kind === "multi" ? value.optionCodes : [];
  const branches = Array.isArray(question.config.branches) ? question.config.branches as Array<{ answer?: string; options?: unknown; answerSubheadings?: unknown }> : [];
  const branch = branches.find(item => item.answer?.trim() === question.options.find(option => option.code === selection[0])?.label.trim());
  const branchSubheadings = textArray(branch?.answerSubheadings);
  const branchOptions = textArray(branch?.options).flatMap((value, index) => value.trim() ? [{ label: value.trim(), subheading: branchSubheadings[index] }] : []);
  const rows = smManagementMatrixLabels(question.config.rows, "row"), columns = smManagementMatrixLabels(question.config.columns, "column");
  const columnSubheadings = textArray(question.config.answerSubheadings);
  const selectedPhotos = value.kind === "photo" ? photos.filter(photo => value.fileIds.includes(photo.id)) : [];
  return <fieldset disabled={disabled} className={styles.editor} aria-label={`Antwort bearbeiten: ${question.text}`}>
    {["single", "yesno", "multiple", "likert", "yesnomulti"].includes(question.type) ? <div className={styles.options}>
      {question.options.map((option, index) => <label key={option.code} className={selection.includes(option.code) ? styles.optionSelected : styles.option}>
        <input type={question.type === "multiple" ? "checkbox" : "radio"} name={inputId} checked={selection.includes(option.code)} onChange={() => {
          if (question.type === "multiple") update({ kind: "multi", optionCodes: selection.includes(option.code) ? selection.filter(code => code !== option.code) : [...selection, option.code] });
          else if (question.type === "yesnomulti") update({ kind: "yesnomulti", optionCode: option.code, subOptions: [] });
          else update({ kind: "choice", optionCode: option.code });
        }} />
        <span>{option.label}{subheadings[index] ? <small>{subheadings[index]}</small> : null}</span>
      </label>)}
      {value.kind === "yesnomulti" && branchOptions.length ? <div className={styles.subOptions}>{branchOptions.map(({ label, subheading }, index) => <label key={`${index}:${label}`} className={styles.option}>
        <input type="checkbox" checked={value.subOptions.includes(label)} onChange={() => update({ ...value, subOptions: value.subOptions.includes(label) ? value.subOptions.filter(item => item !== label) : [...value.subOptions, label] })} />
        <span>{label}{subheading ? <small>{subheading}</small> : null}</span>
      </label>)}</div> : null}
    </div> : null}
    {question.type === "text" ? <textarea aria-label="Antworttext" maxLength={20000} value={value.kind === "text" ? value.value : ""} rows={3} onChange={event => update({ kind: "text", value: event.target.value })} /> : null}
    {question.type === "numeric" || question.type === "slider" ? <label className={styles.field}>Wert
      <input aria-label="Antwortwert" type="number" step={question.type === "numeric" ? question.config.decimals === true ? "any" : 1 : smManagementConfigNumber(question.config.step) ?? "any"}
        min={smManagementConfigNumber(question.config.min)} max={smManagementConfigNumber(question.config.max)}
        value={value.kind === "number" ? value.value : ""} onChange={event => update(event.target.value === "" || !Number.isFinite(event.target.valueAsNumber) ? { kind: "empty" } : { kind: "number", value: event.target.valueAsNumber })} />
    </label> : null}
    {question.type === "matrix" ? <div className={styles.matrix}><table><thead><tr><th scope="col">Auswahl</th>{columns.map(column => <th scope="col" key={column.code}>{column.label}{columnSubheadings[column.index] ? <small>{columnSubheadings[column.index]}</small> : null}</th>)}</tr></thead>
      <tbody>{rows.map(row => <tr key={row.code}><th scope="row">{row.label}</th>{columns.map(column => {
        const rowCode = row.code, columnCode = column.code;
        const selected = value.kind === "matrix" && value.cells.some(cell => cell.rowCode === rowCode && cell.columnCode === columnCode && cell.selected);
        return <td key={columnCode}><input aria-label={`${row.label}: ${column.label}`} name={`${inputId}:${rowCode}`} type="radio" checked={selected} onChange={() => update(smManagementSelectMatrix(value, rowCode, columnCode))} /></td>;
      })}</tr>)}</tbody></table></div> : null}
    {question.type === "photo" ? <div>
      <SmManagementPhotos photos={selectedPhotos} onRemove={id => {
        const ids = value.kind === "photo" ? value.fileIds.filter(fileId => fileId !== id) : [];
        update(ids.length ? { kind: "photo", fileIds: ids } : { kind: "empty" });
      }} />
      <input ref={fileRef} hidden type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={event => { onUpload(Array.from(event.target.files ?? [])); event.target.value = ""; }} />
      <button type="button" className={styles.secondary} onClick={() => fileRef.current?.click()}><Camera size={13} />Fotos ergänzen</button>
      <p className={styles.hint}>JPG, PNG oder WebP · bis 20 MB · Originale bleiben im Verlauf.</p>
    </div> : null}
    {commentEnabled && value.kind !== "empty" ? <label className={styles.field}><span>Kommentar <span className={styles.required}>*</span></span>
      <textarea aria-label="Pflichtkommentar" value={comment} maxLength={2000} rows={2} onChange={event => onChange({ ...value, comment: event.target.value })} placeholder="Kommentar zur ausgewählten Antwort …" />
    </label> : null}
    {!question.required && value.kind !== "empty" ? <button type="button" className={styles.textButton} onClick={() => update({ kind: "empty" })}>Antwort leeren</button> : null}
  </fieldset>;
}

export function SmManagementPhotos({ photos, onRemove }: { photos: SmManagementPhoto[]; onRemove?: (id: string) => void }) {
  return <div className={styles.photos}>{photos.map(photo => <div key={photo.id} className={styles.photo}>
    {photo.signedUrl ? <a href={photo.signedUrl} target="_blank" rel="noreferrer" title="Foto öffnen">
      {/* Private expiring URLs must not pass through a shared image optimizer. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photo.signedUrl} alt={photo.fileName ?? "Besuchsfoto"} loading="lazy" />
    </a> : <span className={styles.hint}>Vorschau nicht verfügbar. Bitte neu laden.</span>}
    <small>{photo.fileName ?? "Foto"}</small>
    {onRemove ? <button type="button" onClick={() => onRemove(photo.id)} aria-label={`${photo.fileName ?? "Foto"} aus Antwort entfernen`}><X size={12} /></button> : null}
  </div>)}</div>;
}
