import type { SMDurcharbeitCatalogScope, SMDurcharbeitQuestionnaireSelection } from "@/types/smSMDurcharbeit";

export function SMDurcharbeitQuestionnaireBadge({ selection, scope, showName = false }: {
  selection?: SMDurcharbeitQuestionnaireSelection | null;
  scope?: SMDurcharbeitCatalogScope | null;
  showName?: boolean;
}) {
  const kind = selection?.catalogScope ?? scope;
  if (!kind) return null;
  const isDurcharbeit = kind === "SMDurcharbeit";
  return <span className="inline-flex max-w-full flex-wrap items-center gap-1.5 align-middle">
    <span className="inline-flex shrink-0 items-center rounded-md border px-1.5 py-0.5 text-[9px] font-semibold leading-tight"
      style={{ color: isDurcharbeit ? "#1D4ED8" : "#64748B", background: isDurcharbeit ? "#EFF6FF" : "#F8FAFC", borderColor: isDurcharbeit ? "#BFDBFE" : "#E2E8F0" }}>
      {isDurcharbeit ? "Durcharbeit" : "Standardfragebogen"}
    </span>
    {showName && selection?.name ? <span className="min-w-0 truncate text-[10px] text-slate-500" title={selection.name}>{selection.name}{selection.versionNumber ? ` · V${selection.versionNumber}` : ""}</span> : null}
  </span>;
}
