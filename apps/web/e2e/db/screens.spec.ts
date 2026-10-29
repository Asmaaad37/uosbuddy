import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";

// End-of-phase screenshots (BUILD_PLAN §8: new screens at 375 px and 1280 px). Runs in the CI
// "e2e" job against its throwaway stack; the images land in the e2e-flows artifact under
// test-results/screens. Also a smoke test: every screen must render for a real student.
test.skip(!process.env.E2E_DB, "needs a local Supabase stack (E2E_DB=1)");

const run = Date.now().toString(36);
const WIDTHS = [
  { name: "375", width: 375, height: 812 },
  { name: "1280", width: 1280, height: 800 },
];

const db = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

/** A verified student with a filled-in profile, made directly through the service role. */
async function makeStudent(name: string, handle: string, onboardingStep: number) {
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
    })
    .eq("id", id);
  expect(profileError).toBeNull();

  const { data: interests } = await supabase
    .from("interests")
    .select("id, label")
    .in("label", ["Cricket", "Coding", "Chai", "Photography", "Gaming"]);
  await supabase
    .from("profile_interests")
    .insert((interests ?? []).map((i) => ({ user_id: id, interest_id: i.id })));
  await supabase
    .from("privacy_settings")
    .update({ profile_visibility: "everyone", photo_visibility: "everyone" })
    .eq("user_id", id);

  return { email, password, handle };
}

async function logIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByRole("tab", { name: "Personal email" }).click();
  const panel = page.getByRole("tabpanel", { name: "Personal email" });
  await panel.getByLabel("Email", { exact: true }).fill(email);
  await panel.getByLabel("Password", { exact: true }).fill(password);
  await panel.getByRole("button", { name: "Log in" }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

/** Opens `path` and saves a full-page shot at each width. */
async function shoot(page: Page, phase: string, name: string, path: string) {
  for (const w of WIDTHS) {
    await page.setViewportSize({ width: w.width, height: w.height });
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    await page.screenshot({
      path: `test-results/screens/${phase}/${name}-${w.name}.png`,
      fullPage: true,
    });
  }
}

test("phase 2 screens", async ({ page }) => {
  test.setTimeout(120_000);
  // Someone else to look at, and a student who is part-way through setup.
  const other = await makeStudent("Ayesha Khan", `ayesha_${run}`.slice(0, 20), 4);
  const me = await makeStudent("Bilal Ahmed", `bilal_${run}`.slice(0, 20), 3);

  await logIn(page, me.email, me.password);
  await shoot(page, "phase-2", "06-setup-academic", "/setup/academic");
  await shoot(page, "phase-2", "07-setup-about", "/setup/about");
  await shoot(page, "phase-2", "08-setup-interests", "/setup/interests");
  await shoot(page, "phase-2", "09-setup-privacy", "/setup/privacy");

  await db()
    .from("profiles")
    .update({ onboarding_step: 4, avatar_url: null })
    .eq("handle", me.handle);
  await shoot(page, "phase-2", "10-explore", "/explore");
  await shoot(page, "phase-2", "11-me", "/me");
  await shoot(page, "phase-2", "12-my-profile", `/people/${me.handle}`);
  await shoot(page, "phase-2", "13-someone-elses-profile", `/people/${other.handle}`);
  await shoot(page, "phase-2", "14-profile-not-available", "/people/nobody_here_x");
  await shoot(page, "phase-2", "15-edit-about", "/setup/about?edit=1");
  await shoot(page, "phase-2", "16-privacy-settings", "/me/privacy");
  await shoot(page, "phase-2", "17-link-uos-email", "/me/email");
});
