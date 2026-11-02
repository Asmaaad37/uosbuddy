import { expect, test, type Browser, type Page } from "@playwright/test";
import { db, logIn, makeStudent, run } from "./helpers";

// Phase 6: a course added by one student is found by another; files, study groups, free
// time together and a ping.
test.skip(!process.env.E2E_DB, "needs a local Supabase stack (E2E_DB=1)");

async function student(browser: Browser, name: string, first: string) {
  const s = await makeStudent(name, `${first}6_${run}`.slice(0, 20), 4);
  const page = await (await browser.newContext()).newPage();
  await logIn(page, s.email, s.password);
  return { page, ...s };
}

const shot = (page: Page, name: string) =>
  page.screenshot({ path: `test-results/screens/phase-6/${name}.png`, fullPage: true });

// A course code unique to this run, so retries and other tests don't collide.
const code = `CS${(Date.now() % 9000) + 1000}`;

test("courses, files, study groups, free time together and a ping", async ({ browser }) => {
  test.setTimeout(150_000);
  const a = await student(browser, "Mahnoor Iqbal", "mahnoor");
  const b = await student(browser, "Talha Rehman", "talha");
  await db()
    .from("connections")
    .insert({ requester_id: a.id, addressee_id: b.id, status: "accepted" });

  // A adds the course (typed loosely) and lands in its room.
  await a.page.goto("/courses");
  await a.page.getByRole("button", { name: "Add a course" }).click();
  await a.page.getByPlaceholder("CS-301 or Data Structures").fill(code.toLowerCase());
  await a.page.getByRole("button", { name: "Can't find it? Add it" }).click();
  await a.page.getByLabel("Course title").fill("Data Structures");
  await a.page.getByRole("button", { name: "Add and join" }).click();
  await expect(a.page).toHaveURL(/\/courses\/[0-9a-f-]{36}$/);
  const pretty = `${code.slice(0, 2)}-${code.slice(2)}`;
  await expect(a.page.getByText(new RegExp(`^${pretty} · CS`))).toBeVisible();
  const courseUrl = a.page.url();

  // A shares a PDF.
  await a.page.getByRole("button", { name: "Share a file" }).click();
  await a.page.locator('input[type="file"]').setInputFiles({
    name: "week1-notes.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\n%%EOF\n"),
  });
  await a.page.getByRole("button", { name: "Share", exact: true }).click();
  await expect(a.page.getByText("week1-notes")).toBeVisible();

  // B finds it by code, joins, upvotes the file and starts a study group.
  await b.page.goto("/courses");
  await b.page.getByRole("button", { name: "Add a course" }).click();
  await b.page.getByPlaceholder("CS-301 or Data Structures").fill(code);
  await b.page.getByRole("button", { name: "Join" }).first().click();
  await expect(b.page).toHaveURL(courseUrl);
  await b.page.getByRole("button", { name: /Upvote, 0/ }).click();
  await expect(b.page.getByRole("button", { name: /Upvote, 1/ })).toBeVisible();
  await shot(b.page, "01-course-files");
  await b.page.goto(`${courseUrl}?tab=groups`);
  await b.page.getByRole("button", { name: "Start a study group" }).click();
  await b.page.getByLabel("Name").fill("Mid-term prep");
  await b.page.getByRole("button", { name: "Create" }).click();
  await expect(b.page).toHaveURL(/\/chats\/[0-9a-f-]{36}$/);
  await a.page.goto(`${courseUrl}?tab=groups`);
  await a.page.getByRole("button", { name: "Join" }).click();
  await expect(a.page).toHaveURL(/\/chats\/[0-9a-f-]{36}$/);

  // Timetables: A busy Mon 9:00–10:30, B busy Mon 12:00–13:00.
  for (const [page, start, end, label] of [
    [a.page, "09:00", "10:30", "DSA"],
    [b.page, "12:00", "13:00", "OOP lab"],
  ] as const) {
    await page.goto("/timetable");
    await page.getByRole("button", { name: "Add a class on Mon" }).click();
    await page.getByLabel("Starts").fill(start);
    await page.getByLabel("Ends").fill(end);
    await page.getByLabel(/What is it\?|Label/).fill(label);
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText(label)).toBeVisible();
  }
  await shot(a.page, "02-timetable");
  await a.page.goto("/timetable?tab=together");
  await a.page.getByRole("checkbox", { name: /Talha/ }).click();
  await a.page.getByRole("button", { name: "Find free time" }).click();
  const monday = a.page
    .getByRole("region", { name: "Free together" })
    .locator("div", { hasText: "Mon" })
    .first();
  await expect(monday.getByText("10:30–12:00")).toBeVisible();
  await expect(monday.getByText("13:00–17:00")).toBeVisible();
  await shot(a.page, "03-free-together");

  // A pings B from their profile.
  await a.page.goto(`/people/${b.handle}`);
  await a.page.getByRole("button", { name: "You free?" }).click();
  await expect(a.page).toHaveURL(/\/chats\/[0-9a-f-]{36}$/);
  await expect(a.page.getByText("You free? 👋")).toBeVisible();
  const { data: pinged } = await db()
    .from("notifications")
    .select("id")
    .eq("user_id", b.id)
    .eq("type", "ping");
  expect(pinged?.length).toBe(1);
});
