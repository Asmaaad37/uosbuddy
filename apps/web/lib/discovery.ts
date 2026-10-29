import type { Database } from "@uosbuddy/shared";

export type DirectoryPerson = Database["public"]["CompositeTypes"]["directory_person"];
export type Suggestion = { person: DirectoryPerson; score: number; reasons: string[] };

/** Directory tabs (Phase 3 task 3), narrowest first. */
export const SCOPES = [
  { key: "section", label: "My section" },
  { key: "batch", label: "My batch" },
  { key: "department", label: "My department" },
  { key: "all", label: "All UoS" },
] as const;
export type Scope = (typeof SCOPES)[number]["key"];

/** The first reason is the strongest, e.g. "Same section"; "Both into Cricket" groups as "Both into". */
function topReason(s: Suggestion) {
  const first = s.reasons[0] ?? "";
  return first.startsWith("Both into")
    ? "Both into"
    : first.startsWith("Also from")
      ? "Also from"
      : first;
}

/**
 * Keeps the list varied (§4.7): no top reason fills more than `maxShare` of the result.
 * Walks the scored list in order and defers anything over its quota to the end, so the
 * best matches still come first and nobody is dropped.
 */
export function diversify(list: Suggestion[], size = list.length, maxShare = 0.4): Suggestion[] {
  const cap = Math.max(1, Math.floor(size * maxShare));
  const used = new Map<string, number>();
  const picked: Suggestion[] = [];
  const deferred: Suggestion[] = [];
  for (const s of list) {
    const key = topReason(s);
    const n = used.get(key) ?? 0;
    if (picked.length < size && n < cap) {
      picked.push(s);
      used.set(key, n + 1);
    } else {
      deferred.push(s);
    }
  }
  return [...picked, ...deferred].slice(0, size);
}

/** "CS · 2024 · Sec B · Morning" for a person card (§6.3 #6). */
export function cardLine(
  p: Pick<DirectoryPerson, "department_code" | "batch_year" | "section" | "shift">,
) {
  const shift = p.shift ? p.shift[0]!.toUpperCase() + p.shift.slice(1) : null;
  return [p.department_code, p.batch_year, p.section && `Sec ${p.section}`, shift]
    .filter(Boolean)
    .join(" · ");
}
