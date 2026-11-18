import path from "node:path";
import { expect, test } from "@playwright/test";
import { db, logIn, makeStudent, run } from "./helpers";

// Phase 11.1: a data editor (here an admin) uploads the CS department's timetable PDF,
// reviews what publishing changes, and publishes; the classes go live.
test.skip(!process.env.E2E_DB, "needs a local Supabase stack (E2E_DB=1)");

// Playwright loads specs as CommonJS, so no import.meta here.
const week4 = path.join(__dirname, "../../lib/timetable/__fixtures__/week4.pdf");

test("an editor imports, reviews and publishes the CS timetable", async ({ browser }) => {
  test.setTimeout(120_000);
  const admin = await makeStudent("Admin Eleven", `admin11_${run}`.slice(0, 20), 4, {
    role: "admin",
  });
  const page = await (await browser.newContext()).newPage();
  await logIn(page, admin.email, admin.password);

  await page.goto("/admin/timetable");
  await expect(page.getByRole("heading", { name: "Timetables" })).toBeVisible();
  await page
    .getByLabel("Department")
    .selectOption({ label: "CS · Department of Computer Science" });
  // The term defaults to the current one, which is the term students see.
  await page.getByLabel("Timetable file").setInputFiles(week4);
  await page.getByRole("button", { name: "Upload and review" }).click();

  // The review page: nothing is live yet, and the classes are listed by group.
  await expect(page).toHaveURL(/\/admin\/timetable\/[0-9a-f-]{36}$/, { timeout: 60_000 });
  await expect(page.getByText("In review")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Classes by group" })).toBeVisible();
  const importId = page.url().split("/").pop()!;
  const supabase = db();
  const { count: staged } = await supabase
    .from("timetable_entries")
    .select("id", { count: "exact", head: true })
    .eq("import_id", importId);
  expect(staged).toBe(103);

  await page.getByRole("button", { name: "Publish" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Publish" }).click();
  await expect(page.getByText("Live", { exact: true })).toBeVisible();

  const { count: live } = await supabase
    .from("timetable_entries")
    .select("id", { count: "exact", head: true })
    .eq("import_id", importId)
    .eq("live", true);
  expect(live).toBe(103);
  const { data: audit } = await supabase
    .from("audit_log")
    .select("action")
    .eq("target_id", importId)
    .eq("action", "timetable.publish");
  expect(audit).toHaveLength(1);

  // Phase 11.2: a BS CS student who joined in Fall 2024 sees their section's week, not the
  // Spring 2024 batch's. In a Fall term they're in semester 5; in a Spring term, semester 6.
  const month = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Karachi", month: "numeric" }).format(
      new Date(),
    ),
  );
  const season = month === 1 || month >= 9 ? "fall" : month <= 6 ? "spring" : "summer";
  test.skip(season === "summer", "no Fall or Spring batch rule in a summer term");
  const student = await makeStudent("Week Student", `week11_${run}`.slice(0, 20), 4, {
    semester: season === "fall" ? 5 : 6,
  });
  const studentPage = await (await browser.newContext()).newPage();
  await logIn(studentPage, student.email, student.password);
  await studentPage.goto("/timetable");
  await expect(studentPage.getByText("BS in Computer Science · Fall 2024 · Regular")).toBeVisible();
  await expect(studentPage.getByText("From your profile")).toBeVisible();
  await studentPage.getByRole("radio", { name: "Mon" }).click();
  const monday = studentPage.getByRole("region", { name: "Classes on Mon" });
  await expect(monday.getByText("Web Technologies")).toBeVisible();
  await expect(monday.getByText("HCI & Computer Graphics")).toBeVisible();
  await expect(monday.getByText("Computer Architecture")).toHaveCount(0);

  // Phase 11.3: look up a room's week, then follow a teacher's name to theirs.
  await studentPage.goto("/timetable?tab=lookup");
  await studentPage.getByRole("radio", { name: "Room" }).click();
  await studentPage.getByLabel("Choose a room").selectOption({ label: "MAB CR-160" });
  await studentPage.getByRole("button", { name: "Show their week" }).click();
  await expect(studentPage).toHaveURL(/\/timetable\/room\/[0-9a-f-]{36}$/);
  await expect(studentPage.getByRole("heading", { name: "MAB CR-160" })).toBeVisible();
  const teacher = studentPage.locator('a[href^="/timetable/teacher/"]').first();
  const teacherName = (await teacher.textContent())!.trim();
  await teacher.click();
  await expect(studentPage.getByRole("heading", { name: teacherName })).toBeVisible();

  // The free-room finder lists rooms, with or without classes.
  await studentPage.goto("/timetable?tab=rooms");
  await expect(studentPage.getByRole("button", { name: "Now" })).toBeVisible();

  // Phase 11.4: the academic calendar, with reminders for every coming deadline.
  await studentPage.goto("/calendar");
  await expect(studentPage.getByRole("heading", { name: "Academic calendar" })).toBeVisible();
  await studentPage.getByRole("button", { name: "Remind me of every deadline" }).click();
  await expect(studentPage.getByText(/reminders? added|You're already set/)).toBeVisible();
  const { count: reminders } = await supabase
    .from("calendar_reminders")
    .select("event_id", { count: "exact", head: true })
    .eq("user_id", student.id);
  const { count: coming } = await supabase
    .from("calendar_events")
    .select("id", { count: "exact", head: true })
    .eq("status", "published")
    .in("kind", ["registration", "add_drop", "withdraw", "midterm", "final", "result", "deadline"])
    .gt("starts_on", new Date(Date.now() + 5 * 3_600_000).toISOString().slice(0, 10));
  expect(reminders).toBe(coming);
});
