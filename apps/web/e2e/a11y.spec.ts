import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// Phase 10 task 3: public pages pass axe's WCAG 2.1 AA rules, in both themes.
const PAGES = [
  "/",
  "/start/campus",
  "/start/email",
  "/login",
  "/privacy",
  "/terms",
  "/guidelines",
  "/safety",
  "/offline",
];

for (const scheme of ["light", "dark"] as const) {
  test.describe(`${scheme} theme`, () => {
    test.use({ colorScheme: scheme });
    for (const path of PAGES) {
      test(`${path} has no WCAG 2.1 AA violations`, async ({ page }) => {
        await page.goto(path);
        // Not "networkidle": the login page's captcha keeps a connection open.
        await page.getByRole("heading").first().waitFor();
        await page.locator("#boot-splash").waitFor({ state: "hidden" });
        const { violations } = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
          .analyze();
        expect(
          violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`),
        ).toEqual([]);
      });
    }
  });
}
