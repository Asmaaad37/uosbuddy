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
  await page.getByLabel("Term").selectOption({ label: "Fall 2026" });
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
});
