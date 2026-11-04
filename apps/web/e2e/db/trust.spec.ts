import { expect, test, type Browser, type Page } from "@playwright/test";
import { db, logIn, makeStudent, run } from "./helpers";

// Phase 9: guidelines before a first post; an admin appoints a moderator who removes a
// reported post (audited); bans; the admin dashboard; Me → Data export and deletion.
test.skip(!process.env.E2E_DB, "needs a local Supabase stack (E2E_DB=1)");

async function student(
  browser: Browser,
  name: string,
  first: string,
  extra: Record<string, unknown> = {},
) {
  const s = await makeStudent(name, `${first}9_${run}`.slice(0, 20), 4, extra);
  const page = await (await browser.newContext()).newPage();
  await logIn(page, s.email, s.password);
  return { page, ...s };
}

const shot = (page: Page, name: string) =>
  page.screenshot({ path: `test-results/screens/phase-9/${name}.png`, fullPage: true });

test("guidelines, a moderator removes a reported post, and a ban", async ({ browser }) => {
  test.setTimeout(150_000);
  const [author, mod, admin] = await Promise.all([
    student(browser, "Nadia Hussain", "nadia", { guidelines_accepted_at: null }),
    student(browser, "Omer Farooq", "omer"),
    student(browser, "Admin Nine", "admin", { role: "admin" }),
  ]);
  const body = `Selling last year's paper, DM me ${run}`;

  // A first post asks the author to accept the guidelines, then goes through.
  await author.page.goto("/feed?sort=new");
  await author.page.getByRole("button", { name: "Write a post" }).click();
  await author.page.getByLabel("What's happening?").fill(body);
  await author.page.getByRole("button", { name: "Post", exact: true }).click();
  await expect(author.page.getByRole("heading", { name: "Before you post" })).toBeVisible();
  await shot(author.page, "01-guidelines");
  await author.page.getByRole("button", { name: "I agree" }).click();
  // Saved once the composer closes and the post is in the feed.
  await expect(author.page.getByRole("dialog")).toHaveCount(0);
  await expect(author.page.getByRole("article").filter({ hasText: body })).toBeVisible();
  const { data: post } = await db().from("posts").select("id").eq("body", body).single();
  await db()
    .from("reports")
    .insert({ reporter_id: admin.id, target_type: "post", target_id: post!.id, reason: "other" });

  // The admin makes Omer a campus moderator.
  await admin.page.goto(`/admin/users?q=${encodeURIComponent("Omer Farooq")}`);
  const row = admin.page.getByRole("listitem").filter({ hasText: "Omer Farooq" });
  await row.getByRole("button", { name: "Make moderator" }).click();
  await row.getByRole("checkbox", { name: "Campus feed" }).check();
  await row.getByRole("button", { name: "Save" }).click();
  await expect(row.getByText("moderator", { exact: true })).toBeVisible();

  // Omer sees the report in his queue and removes the post.
  await mod.page.goto("/admin/reports");
  const item = mod.page.getByRole("listitem").filter({ hasText: body });
  await expect(item.getByText("1 report: other")).toBeVisible();
  await shot(mod.page, "02-reports");
  await item.getByRole("button", { name: "Remove" }).click();
  await expect(mod.page.getByText("Removed", { exact: true }).first()).toBeVisible();
  await author.page.reload();
  await expect(author.page.getByText(body)).toHaveCount(0);
  const { data: audit } = await db()
    .from("audit_log")
    .select("action, actor_id")
    .in("action", ["moderator.set", "content.hide"]);
  expect(audit).toEqual(
    expect.arrayContaining([
      { action: "moderator.set", actor_id: admin.id },
      { action: "content.hide", actor_id: mod.id },
    ]),
  );

  // The admin bans the author: they only see the suspension notice.
  await admin.page.goto(`/admin/users?q=${encodeURIComponent("Nadia Hussain")}`);
  const nadia = admin.page.getByRole("listitem").filter({ hasText: "Nadia Hussain" });
  await nadia.getByRole("button", { name: "Ban" }).click();
  await nadia.getByLabel("Reason for the ban").fill("Selling exam papers");
  await nadia.getByRole("button", { name: "Ban" }).last().click();
  await expect(nadia.getByText("Banned")).toBeVisible();
  await author.page.goto("/feed");
  await expect(author.page).toHaveURL(/\/banned$/);
  await expect(
    author.page.getByRole("heading", { name: "Your account is suspended" }),
  ).toBeVisible();

  // The dashboard counts it all.
  await admin.page.goto("/admin");
  await expect(admin.page.getByText("Verification funnel")).toBeVisible();
  await expect(admin.page.getByText("user.ban").first()).toBeVisible();
  await shot(admin.page, "03-dashboard");
});

test("Me → Data: export, then delete with a 14-day way back", async ({ browser }) => {
  test.setTimeout(90_000);
  const me = await student(browser, "Rabia Saleem", "rabia");

  await me.page.goto("/me/data");
  await me.page.getByRole("button", { name: "Export my data" }).click();
  const link = me.page.getByRole("link", { name: "Download your data" });
  await expect(link).toBeVisible();
  const file = await me.page.request.get((await link.getAttribute("href"))!);
  const data = await file.json();
  expect(data.profile.full_name).toBe("Rabia Saleem");

  await me.page.getByLabel("Type DELETE to confirm").fill("DELETE");
  await me.page.getByRole("button", { name: "Delete my account" }).click();
  await expect(
    me.page.getByRole("heading", { name: "Your account is being deleted" }),
  ).toBeVisible();
  await shot(me.page, "04-deleting");
  await me.page.goto("/explore");
  await expect(me.page).toHaveURL(/\/me\/data$/);
  await me.page.getByRole("button", { name: "Keep my account" }).click();
  await expect(me.page).toHaveURL(/\/explore$/);
});
