import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { logIn, makeStudent, run } from "./helpers";

// Phase 10 task 3: signed-in pages pass axe's WCAG 2.1 AA rules on a phone, in both themes.
test.skip(!process.env.E2E_DB, "needs a local Supabase stack (E2E_DB=1)");

const STUDENT = [
  "/explore",
  "/explore/batch",
  "/feed",
  "/backup",
  "/chats",
  "/notifications",
  "/courses",
  "/timetable",
  "/gpa",
  "/mentors",
  "/rides",
  "/market",
  "/events",
  "/events?tab=societies",
  "/me",
  "/me/privacy",
  "/me/notifications",
  "/me/data",
];
const ADMIN = [
  "/admin",
  "/admin/reports",
  "/admin/users",
  "/admin/catalogue",
  "/admin/flags",
  "/admin/campus",
  "/admin/verifications",
  "/admin/studies",
];

for (const scheme of ["light", "dark"] as const) {
  test(`signed-in pages pass axe (${scheme})`, async ({ browser }) => {
    test.setTimeout(240_000);
    const s = await makeStudent("Axe Tester", `axe${scheme}_${run}`.slice(0, 20), 4, {
      role: "admin",
    });
    const page = await (
      await browser.newContext({ colorScheme: scheme, viewport: { width: 375, height: 812 } })
    ).newPage();
    await logIn(page, s.email, s.password);

    const found: string[] = [];
    for (const path of [...STUDENT, ...(process.env.AI_FAKE ? ["/buddy"] : []), ...ADMIN]) {
      await page.goto(path);
      await page.getByRole("heading").first().waitFor();
      const { violations } = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      for (const v of violations) {
        found.push(`${path} ${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
      }
    }
    expect(found).toEqual([]);
  });
}
