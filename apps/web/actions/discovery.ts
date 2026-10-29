"use server";

import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { diversify, type DirectoryPerson, type Suggestion } from "@/lib/discovery";
import { cached } from "@/lib/redis.server";
import type { ActionResult } from "./onboarding";

const PAGE = 30;

const directorySchema = z.object({
  scope: z.enum(["section", "batch", "department", "all"]),
  query: z.string().trim().max(60).optional(),
  shift: z.enum(["morning", "evening", "weekend"]).optional(),
  residence: z.enum(["day_scholar", "hostelite", "other"]).optional(),
  hometown: z.string().trim().max(60).optional(),
  interest: z.uuid().optional(),
  after: z.object({ key: z.string(), id: z.uuid() }).optional(),
});
export type DirectoryQuery = z.input<typeof directorySchema>;
export type DirectoryPage = {
  people: DirectoryPerson[];
  next: { key: string; id: string } | null;
};

/** One page of the batch directory (Phase 3 task 3). Privacy is applied in SQL. */
export async function loadDirectory(input: DirectoryQuery): Promise<ActionResult<DirectoryPage>> {
  const parsed = directorySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the filters" };
  const { supabase, user } = await getSession();
  if (!user) return { ok: false, error: "Your session expired. Log in again." };

  const q = parsed.data;
  const { data, error } = await supabase.rpc("directory", {
    p_scope: q.scope,
    p_query: q.query || undefined,
    p_shift: q.shift,
    p_residence: q.residence,
    p_hometown: q.hometown || undefined,
    p_interest: q.interest,
    p_after_key: q.after?.key,
    p_after_id: q.after?.id,
    p_limit: PAGE,
  });
  if (error) return { ok: false, error: "Couldn't load people. Try again." };

  const people = data ?? [];
  const last = people.at(-1);
  return {
    ok: true,
    data: {
      people,
      next:
        people.length === PAGE && last?.sort_key && last.id
          ? { key: last.sort_key, id: last.id }
          : null,
    },
  };
}

/**
 * "People like you" (Phase 3 task 5): scored in SQL, varied so no one reason fills more than
 * 40%, cached per student for 15 minutes.
 */
export async function getSuggestions(size = 12): Promise<Suggestion[]> {
  const { supabase, user } = await getSession();
  if (!user) return [];
  return cached(`uosbuddy:suggest:${user.id}`, 15 * 60, async () => {
    const { data } = await supabase.rpc("suggest_people", { p_limit: 50 });
    const scored = (data ?? []).map((row) => ({
      person: row.person,
      score: Number(row.score),
      reasons: row.reasons ?? [],
    }));
    return diversify(scored, 50).slice(0, size);
  });
}

/** Batch reveal and hub numbers: who the student can already find. */
export async function getDirectoryCounts() {
  const { supabase, user } = await getSession();
  if (!user) return null;
  const { data } = await supabase.rpc("directory_counts").maybeSingle();
  return data;
}
