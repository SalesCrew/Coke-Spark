const SMDurcharbeitPrefix = "SMDurcharbeit:";
const SMDurcharbeitUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Domain identity travels with the owner-scoped cache/queue key; it is never an assignment ID. */
export function SMDurcharbeitVisitId(reference: string): string | null {
  if (!reference.startsWith(SMDurcharbeitPrefix)) return null;
  const id = reference.slice(SMDurcharbeitPrefix.length);
  if (!SMDurcharbeitUuid.test(id)) throw new Error("Ungültige Durcharbeit-Besuchskennung.");
  return id;
}
export function SMDurcharbeitVisitReference(id: string) {
  if (!SMDurcharbeitUuid.test(id)) throw new Error("Ungültige Durcharbeit-Besuchskennung.");
  return `${SMDurcharbeitPrefix}${id}`;
}
export function smVisitApiPath(reference: string) {
  const id = SMDurcharbeitVisitId(reference);
  return id ? `/sm/smdurcharbeit/visits/${encodeURIComponent(id)}` : `/sm/visits/${encodeURIComponent(reference)}`;
}
export function smVisitResumeHref(reference: string, questionId?: string | null) {
  const id = SMDurcharbeitVisitId(reference);
  const query = new URLSearchParams(id ? { visitId: id } : { assignmentId: reference });
  if (questionId) query.set("questionId", questionId);
  return `${id ? "/sm/durcharbeit-besuch" : "/sm/marktbesuch"}?${query}`;
}
