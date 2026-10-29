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
async function makeStudent(
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

test("phase 3 screens", async ({ page, browser }) => {
  test.setTimeout(150_000);
  const h = (first: string) => `${first.toLowerCase()}3_${run}`.slice(0, 20);
  // A small batch: CS 2024 across two sections, one from another batch, one from IT.
  await makeStudent("Ayesha Siddiqui", h("Ayesha"), 4, {}, ["Cricket", "Coding", "Chai"]);
  await makeStudent("Usman Tariq", h("Usman"), 4, { residence: "day_scholar" }, [
    "Coding",
    "Gaming",
  ]);
  await makeStudent("Fatima Noor", h("Fatima"), 4, { section: "A", hometown_city: "Lahore" }, [
    "Photography",
    "Books",
  ]);
  await makeStudent("Hamza Ali", h("Hamza"), 4, { section: "A", shift: "evening" }, ["Cricket"]);
  await makeStudent("Zainab Raza", h("Zainab"), 4, { batch_year: 2023 }, ["Debating", "Chai"]);
  const me = await makeStudent("Saad Mehmood", h("Saad"), 4, {}, ["Cricket", "Chai", "Coding"]);

  await logIn(page, me.email, me.password);
  await shoot(page, "phase-3", "01-batch-reveal", "/explore?welcome=1");
  await expect(page.getByRole("heading", { name: /already here/ })).toBeVisible();
  await shoot(page, "phase-3", "02-explore", "/explore");
  await expect(page.getByRole("heading", { name: "People like you" })).toBeVisible();
  await expect(page.getByText("Same section").first()).toBeVisible();

  await shoot(page, "phase-3", "03-directory-section", "/explore/batch");
  await expect(page.getByText("Ayesha Siddiqui")).toBeVisible();
  await expect(page.getByText("Fatima Noor")).toHaveCount(0);
  await shoot(page, "phase-3", "04-directory-batch", "/explore/batch?tab=batch");
  await expect(page.getByText("Fatima Noor")).toBeVisible();
  await expect(page.getByText("Zainab Raza")).toHaveCount(0);

  // Search and filters, at phone width.
  await page.setViewportSize({ width: 375, height: 812 });
  await page.getByRole("tab", { name: /All UoS/ }).click();
  await page.getByPlaceholder("Search by name or @handle").fill("zain");
  await expect(page.getByText("Zainab Raza")).toBeVisible();
  await expect(page.getByText("Ayesha Siddiqui")).toHaveCount(0);
  await page.getByPlaceholder("Search by name or @handle").fill("");
  await page.getByRole("button", { name: "Filters" }).click();
  await page.getByLabel("Hometown").fill("Lahore");
  await page.screenshot({ path: "test-results/screens/phase-3/05-filters-375.png" });
  await page.getByRole("button", { name: "Show people" }).click();
  await expect(page.getByText("Fatima Noor")).toBeVisible();
  await expect(page.getByText("Ayesha Siddiqui")).toHaveCount(0);
  await page.screenshot({
    path: "test-results/screens/phase-3/06-filtered-375.png",
    fullPage: true,
  });

  // Invite link (code made when /explore rendered), seen by someone signed out.
  const { data: invite } = await db()
    .from("invites")
    .select("code, profiles!inner(handle)")
    .eq("profiles.handle", me.handle)
    .single();
  const visitor = await (await browser.newContext()).newPage();
  await shoot(visitor, "phase-3", "07-invite", `/i/${invite!.code}`);
  await expect(visitor.getByText("Saad invited you")).toBeVisible();
  await expect(
    visitor.getByRole("heading", { name: /of CS 2024 are already on UOSBuddy/ }),
  ).toBeVisible();
  const ogImage = await visitor.locator('meta[property="og:image"]').getAttribute("content");
  const image = await visitor.request.get(ogImage!);
  expect(image.headers()["content-type"]).toBe("image/png");
  await visitor.goto(ogImage!);
  await visitor.screenshot({ path: "test-results/screens/phase-3/08-invite-share-image.png" });
});
