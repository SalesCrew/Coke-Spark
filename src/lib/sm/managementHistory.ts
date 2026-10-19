import type { SmManagementHistory } from "@/types/smManagement";

type Entry = SmManagementHistory["entries"][number];
function answerKey(value: Entry["value"]) {
  if (!value || typeof value !== "object") return JSON.stringify(value);
  return JSON.stringify(Object.fromEntries(Object.entries(value).filter(([key]) => key !== "comment").sort(([a],[b]) => a.localeCompare(b))));
}

/** Readable history only: raw audit rows and pagination cursors remain unchanged. */
export function smManagementHistoryEntries(entries: Entry[]): Entry[] {
  const visible: Entry[] = [];
  let previous: Entry | undefined;
  for (const entry of entries) {
    const newerComment = previous?.value?.comment?.trim() ?? "", olderComment = entry.value?.comment?.trim() ?? "";
    const gap = previous ? Date.parse(previous.at) - Date.parse(entry.at) : NaN;
    const typingSnapshot = previous && previous.version === entry.version + 1 &&
      previous.actorId && previous.actorId === entry.actorId && !previous.reason && !entry.reason &&
      previous.state === entry.state && answerKey(previous.value) === answerKey(entry.value) &&
      newerComment && olderComment && gap >= 0 && gap <= 90_000 &&
      (newerComment.startsWith(olderComment) || olderComment.startsWith(newerComment));
    if (!typingSnapshot) visible.push(entry);
    previous = entry;
  }
  return visible;
}
