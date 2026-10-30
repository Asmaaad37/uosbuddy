import { createClient } from "@supabase/supabase-js";
import { expect, type Page } from "@playwright/test";

// Shared by the e2e/db specs: sample students made directly through the service role.

export const run = Date.now().toString(36);
export const WIDTHS = [
  { name: "375", width: 375, height: 812 },
  { name: "1280", width: 1280, height: 800 },
];

export const db = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

/** A verified student with a filled-in profile, made directly through the service role. */
export async function makeStudent(
  name: string,
  handle: string,
  onboardingStep: number,
  extra: Record<string, unknown> = {},
  interestLabels = ["Cricket", "Coding", "Chai", "Photography", "Gaming"],
) {
  const supabase = db();
  const email = `${handle}-${run}@example.com`;
  const password = `Screens-${run}-pass!`;
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  expect(error).toBeNull();
  const id = data.user!.id;

  const { data: dept } = await supabase
    .from("departments")
    .select("id")
    .eq("short_code", "CS")
    .single();
  const { data: program } = await supabase
    .from("programs")
    .select("id")
    .eq("name", "BS in Computer Science")
    .single();
  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      full_name: name,
      handle,
      verification_status: "verified",
      verification_method: "document",
      verified_at: new Date().toISOString(),
      department_id: dept!.id,
      program_id: program!.id,
      batch_year: 2024,
      semester: 5,
      section: "B",
      shift: "morning",
      residence: "hostelite",
      hometown_city: "Sargodha",
      bio: "CS student. Usually found in the library or at the cricket ground.",
      opening_move_prompt: "Best chai spot near campus is…",
      opening_move: "The dhaba behind the main gate, no contest.",
      onboarding_step: onboardingStep,
      ...extra,
    })
    .eq("id", id);
  expect(profileError).toBeNull();

  const { data: interests } = await supabase
    .from("interests")
    .select("id, label")
    .in("label", interestLabels);
  await supabase
    .from("profile_interests")
    .insert((interests ?? []).map((i) => ({ user_id: id, interest_id: i.id })));
  await supabase
    .from("privacy_settings")
    .update({ profile_visibility: "everyone", photo_visibility: "everyone" })
    .eq("user_id", id);

  return { id, email, password, handle };
}

export async function logIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByRole("tab", { name: "Personal email" }).click();
  const panel = page.getByRole("tabpanel", { name: "Personal email" });
  await panel.getByLabel("Email", { exact: true }).fill(email);
  await panel.getByLabel("Password", { exact: true }).fill(password);
  await panel.getByRole("button", { name: "Log in" }).click();
  await expect(page).not.toHaveURL(/\/login/);
}
