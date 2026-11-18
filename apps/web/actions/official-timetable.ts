"use server";

import { z } from "zod";
import { fail, friendly, session } from "@/lib/action-helpers.server";
import type { ActionResult } from "./onboarding";

const id = z.uuid();

/**
 * Phase 11.1: a data editor reviews a staged timetable import, then publishes, discards or
 * restores. Every step is checked and audited in the database (is_data_editor).
 */
async function call(
  fn: "publish_import" | "discard_import" | "revert_import",
  importId: string,
  fallback: string,
): Promise<ActionResult> {
  if (!id.safeParse(importId).success) return fail("Import not found");
  const s = await session();
  if (!s) return fail("Your session expired. Log in again.");
  const { error } = await s.supabase.rpc(fn, { p_import: importId });
  if (error) return fail(friendly(error, fallback));
  return { ok: true, data: undefined };
}

export async function publishImport(importId: string) {
  return call("publish_import", importId, "Couldn't publish. Try again.");
}

export async function discardImport(importId: string) {
  return call("discard_import", importId, "Couldn't discard. Try again.");
}

/** Republishes a copy of an earlier import, so the change history stays honest. */
export async function restoreImport(importId: string) {
  return call("revert_import", importId, "Couldn't restore. Try again.");
}

export async function excludeEntry(entryId: string, excluded: boolean): Promise<ActionResult> {
  if (!id.safeParse(entryId).success) return fail("Class not found");
  const s = await session();
  if (!s) return fail("Your session expired. Log in again.");
  const { error } = await s.supabase.rpc("exclude_entry", {
    p_entry: entryId,
    p_excluded: excluded,
  });
  if (error) return fail(friendly(error, "Couldn't change that class. Try again."));
  return { ok: true, data: undefined };
}
