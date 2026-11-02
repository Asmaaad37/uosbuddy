/** "2026-fall" → "Fall 2026". */
export function termLabel(term: string | null | undefined) {
  const m = /^(\d{4})-(fall|spring|summer)$/.exec(term ?? "");
  if (!m) return "";
  return `${m[2]![0]!.toUpperCase()}${m[2]!.slice(1)} ${m[1]}`;
}

export const RESOURCE_KINDS = {
  notes: "Notes",
  past_paper: "Past paper",
  outline: "Course outline",
  slides: "Slides",
  assignment: "Assignment",
} as const;
export type ResourceKind = keyof typeof RESOURCE_KINDS;

/** "1.2 MB" / "340 KB". */
export function fileSize(bytes: number) {
  return bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
