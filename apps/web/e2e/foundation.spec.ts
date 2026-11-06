import { expect, test } from "@playwright/test";

test("home renders the disclaimer footer", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "FIND YOUR BATCH." })).toBeVisible();
  await expect(page.getByText("not an official University of Sargodha service")).toBeVisible();
});

test("design system renders every component group in both themes", async ({ page }, info) => {
  test.slow(); // full-page screenshot of a long page
  await page.goto("/design");
  for (const theme of ["DARK", "LIGHT"]) {
    await expect(page.getByText(theme, { exact: true })).toBeVisible();
  }
  for (const group of ["Buttons", "Inputs", "Segmented control", "Grouped list", "Tab bar"]) {
    await expect(page.getByRole("heading", { name: group })).toHaveCount(2);
  }
  await page.screenshot({ path: `screenshots/design-${info.project.name}.png`, fullPage: true });
});

for (const path of ["/", "/design"]) {
  test(`${path} has no horizontal scroll`, async ({ page }) => {
    await page.goto(path);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);
  });
}

test("dialog and sheet open and close with the keyboard", async ({ page }) => {
  await page.goto("/design");
  await page.getByRole("button", { name: "Open dialog" }).first().click();
  await expect(page.getByRole("dialog", { name: "Block Bilal?" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.getByRole("button", { name: "Open sheet" }).first().click();
  await expect(page.getByRole("dialog", { name: "Filters" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("PWA manifest and icons are served", async ({ request }) => {
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(manifest.start_url).toBe("/explore");
  expect(manifest.display).toBe("standalone");
  for (const icon of manifest.icons as { src: string }[]) {
    const res = await request.get(icon.src);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("image/png");
  }
});

// Lighthouse 12 dropped its PWA audit, so ask Chrome directly whether the app is installable.
test("Chrome reports the app as installable", async ({ page, browserName }, info) => {
  test.skip(browserName !== "chromium" || info.project.name !== "desktop", "Chromium desktop only");
  await page.goto("/");
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  const cdp = await page.context().newCDPSession(page);
  const { installabilityErrors } = await cdp.send("Page.getInstallabilityErrors");
  // Playwright contexts are always incognito-like; every other criterion must pass.
  expect(installabilityErrors.filter((e) => e.errorId !== "in-incognito")).toEqual([]);
});

test("security headers are set", async ({ request }) => {
  const res = await request.get("/");
  const headers = res.headers();
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(headers["x-content-type-options"]).toBe("nosniff");
});
