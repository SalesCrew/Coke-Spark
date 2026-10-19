import type { SMDurcharbeitReportAnswer } from "@/types/smSMDurcharbeitCampaign";

/** Labels belong to the submitted question snapshot, never the mutable authoring catalog. */
export function smExportAnswerValue(row: SMDurcharbeitReportAnswer): string | number {
  if (row.question.isApplicable === false || row.answer?.answerState === "not_applicable") return "Nicht anwendbar";
  const value = row.answer?.valueJson;
  if (!value || value.kind === "empty" || row.answer?.answerState === "unanswered") return "Nicht beantwortet";
  if (row.answer?.answerState !== "answered") return "Ungültige Antwort";
  const label = (code: string) => {
    const option = row.question.answerOptionsSnapshot.find(option => option.code === code);
    return typeof option?.label === "string" ? option.label : `Unbekannte Auswahl (${code})`;
  };
  switch (value.kind) {
    case "choice": return label(value.optionCode);
    case "multi": return value.optionCodes.map(label).join(", ") || "Nicht beantwortet";
    case "yesnomulti": return [label(value.optionCode), ...value.subOptions].join(" · ");
    case "number": return Number.isFinite(value.value) ? value.value : "Ungültige Zahl";
    case "text": return value.value || "Nicht beantwortet";
    case "photo": return value.fileIds.length ? `${value.fileIds.length} Foto${value.fileIds.length === 1 ? "" : "s"}` : "Keine verfügbaren Fotos";
    case "matrix": {
      const config = row.question.configSnapshot ?? {};
      const axisLabel = (code: string, key: "rows" | "columns") => {
        const labels = Array.isArray(config[key]) ? config[key] : [];
        // Preserve original indexes, including blank historical labels.
        const text = labels[Number(code.split("_")[1]) - 1];
        return typeof text === "string" && text.trim() ? text : `Unbekannt (${code})`;
      };
      return value.cells.filter(cell => cell.selected).map(cell => `${axisLabel(cell.rowCode, "rows")}: ${axisLabel(cell.columnCode, "columns")}`).join(" · ") || "Nicht beantwortet";
    }
  }
}

export function smExportAnswerComment(row: SMDurcharbeitReportAnswer): string {
  return row.question.isApplicable !== false && row.answer?.answerState === "answered" ? row.answer.valueJson?.comment ?? "" : "";
}
