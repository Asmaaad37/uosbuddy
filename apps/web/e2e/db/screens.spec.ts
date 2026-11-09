import { expect, test, type Page } from "@playwright/test";
import { WIDTHS, db, logIn, makeStudent, run } from "./helpers";

// End-of-phase screenshots (BUILD_PLAN §8: new screens at 375 px and 1280 px). Runs in the CI
// "e2e" job against its throwaway stack; the images land in the e2e-flows artifact under
// test-results/screens. Also a smoke test: every screen must render for a real student.
test.skip(!process.env.E2E_DB, "needs a local Supabase stack (E2E_DB=1)");

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
  // By profile link, not name: a retried run leaves the first attempt's students behind.
  const card = (first: string) => page.locator(`a[href="/people/${h(first)}"]`);
  // A small batch: CS 2024 across two sections, one from another batch, one from IT.
  await makeStudent("Ayesha Siddiqui", h("Ayesha"), 4, {}, ["Cricket", "Coding", "Chai"]);
  await makeStudent("Usman Tariq", h("Usman"), 4, { residence: "day_scholar" }, [
    "Coding",
    "Gaming",
  ]);
  await makeStudent("Fatima Noor", h("Fatima"), 4, { section: "SS1", hometown_city: "Lahore" }, [
    "Photography",
    "Books",
  ]);
  await makeStudent("Hamza Ali", h("Hamza"), 4, { section: "SS1", shift: "evening" }, ["Cricket"]);
  await makeStudent("Zainab Raza", h("Zainab"), 4, { batch_year: 2023 }, ["Debating", "Chai"]);
  const me = await makeStudent("Saad Mehmood", h("Saad"), 4, {}, ["Cricket", "Chai", "Coding"]);

  await logIn(page, me.email, me.password);
  await shoot(page, "phase-3", "01-batch-reveal", "/explore?welcome=1");
  await expect(page.getByRole("heading", { name: /already here/ })).toBeVisible();
  await shoot(page, "phase-3", "02-explore", "/explore");
  await expect(page.getByRole("heading", { name: "People like you" })).toBeVisible();
  await expect(page.getByText("Same section").first()).toBeVisible();

  await shoot(page, "phase-3", "03-directory-section", "/explore/batch");
  await expect(card("Ayesha")).toBeVisible();
  await expect(card("Fatima")).toHaveCount(0);
  await shoot(page, "phase-3", "04-directory-batch", "/explore/batch?tab=batch");
  await expect(card("Fatima")).toBeVisible();
  await expect(card("Zainab")).toHaveCount(0);

  // Search and filters, at phone width.
  await page.setViewportSize({ width: 375, height: 812 });
  await page.getByRole("tab", { name: /All UoS/ }).click();
  await page.getByPlaceholder("Search by name or @handle").fill("zain");
  await expect(card("Zainab")).toBeVisible();
  await expect(card("Ayesha")).toHaveCount(0);
  await page.getByPlaceholder("Search by name or @handle").fill("");
  await page.getByRole("button", { name: "Filters" }).click();
  await page.getByLabel("Hometown").fill("Lahore");
  await page.screenshot({ path: "test-results/screens/phase-3/05-filters-375.png" });
  await page.getByRole("button", { name: "Show people" }).click();
  await expect(card("Fatima")).toBeVisible();
  await expect(card("Ayesha")).toHaveCount(0);
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
