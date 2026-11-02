import { expect, test, type Browser, type Page } from "@playwright/test";
import { db, logIn, makeStudent, run } from "./helpers";

// Phase 5: the anonymous author never reaches another student's browser, and a Backup
// request goes through its whole life between two students.
test.skip(!process.env.E2E_DB, "needs a local Supabase stack (E2E_DB=1)");

async function student(browser: Browser, name: string, first: string) {
  const s = await makeStudent(name, `${first}5_${run}`.slice(0, 20), 4);
  const page = await (await browser.newContext()).newPage();
  await logIn(page, s.email, s.password);
  return { page, ...s };
}

const shot = (page: Page, name: string) =>
  page.screenshot({ path: `test-results/screens/phase-5/${name}.png`, fullPage: true });

test("an anonymous post never reveals its author to anyone else", async ({ browser }) => {
  test.setTimeout(120_000);
  await db().from("feature_flags").update({ enabled: true }).eq("key", "anonymous_posts");
  const a = await student(browser, "Hina Anwar", "hina");
  const b = await student(browser, "Kamran Shah", "kamran");

  // A posts anonymously with a poll.
  await a.page.goto("/feed?sort=new");
  await a.page.getByRole("button", { name: "Write a post" }).click();
  await a.page.getByLabel("What's happening?").fill(`Which canteen has the best samosas? ${run}`);
  await a.page.getByRole("button", { name: "Poll" }).click();
  await a.page.getByLabel("Option 1").fill("Main canteen");
  await a.page.getByLabel("Option 2").fill("Science block");
  await a.page.getByRole("switch", { name: /Post anonymously/ }).check();
  await a.page.screenshot({ path: "test-results/screens/phase-5/01-composer.png" });
  await a.page.getByRole("button", { name: "Post", exact: true }).click();
  await expect(a.page.getByText(`Which canteen has the best samosas? ${run}`)).toBeVisible();

  // B reads the feed and the thread; every response B's browser receives is captured.
  const bodies: string[] = [];
  b.page.on("response", async (res) => {
    try {
      bodies.push(await res.text());
    } catch {
      // Redirects and aborted requests have no body.
    }
  });
  await b.page.goto("/feed?sort=new");
  const post = b.page.locator("article", { hasText: `Which canteen has the best samosas? ${run}` });
  await expect(post).toBeVisible();
  await expect(post.getByText("Anonymous")).toBeVisible();
  await post.getByRole("button", { name: "Main canteen" }).click();
  await expect(post.getByText("100%")).toBeVisible();
  await post.getByRole("link", { name: /comments/ }).click();
  await b.page.getByLabel("Your comment").fill("Main canteen, no contest");
  await b.page.getByRole("button", { name: "Comment", exact: true }).click();
  await expect(b.page.getByText("Main canteen, no contest")).toBeVisible();
  await shot(b.page, "02-thread");
  await b.page.goto("/feed?sort=new");
  await expect(post).toBeVisible();
  await shot(b.page, "03-feed");

  const leaked = bodies.filter((t) => t.includes(a.id) || t.includes(a.handle));
  expect(bodies.length).toBeGreaterThan(5);
  expect(leaked, "A's id or handle reached B's browser").toEqual([]);
});

test("a Backup request: ask, claim, chat, mark done", async ({ browser }) => {
  test.setTimeout(120_000);
  const a = await student(browser, "Nida Akhtar", "nida");
  const b = await student(browser, "Faisal Iqbal", "faisal");

  // A asks; B (same section) is notified and sees it near them.
  await a.page.goto("/backup");
  await a.page.getByRole("button", { name: "Ask for backup" }).click();
  await a.page.getByRole("radio", { name: /Notes/ }).click();
  await a.page.getByLabel("In a few words").fill(`Need DSA notes from Monday ${run}`);
  await a.page.screenshot({ path: "test-results/screens/phase-5/04-ask.png" });
  await a.page.getByRole("button", { name: "Send to my classmates" }).click();
  await expect(a.page.getByText("Waiting for help")).toBeVisible();
  const { data: pinged } = await db()
    .from("notifications")
    .select("id")
    .eq("user_id", b.id)
    .eq("type", "backup.nearby");
  expect(pinged?.length).toBe(1);

  await b.page.goto("/backup");
  const card = b.page.locator("li", { hasText: `Need DSA notes from Monday ${run}` });
  await expect(card.getByText("Your section")).toBeVisible();
  await shot(b.page, "05-backup");
  await card.getByRole("button", { name: "I can help" }).click();
  await expect(b.page).toHaveURL(/\/chats\/[0-9a-f-]{36}$/);
  await expect(b.page.getByText(/Backup: Need DSA notes/)).toBeVisible();

  // A sees it's claimed, then marks it done; B earns the points.
  await a.page.reload();
  await expect(a.page.getByText("Someone's on it")).toBeVisible();
  await a.page.getByRole("button", { name: "Mark done" }).click();
  await expect(a.page.getByText("Done", { exact: true })).toBeVisible();
  await b.page.goto("/backup");
  await expect(b.page.getByText(/Helped 1×/)).toBeVisible();
});
