import { expect, test } from "@playwright/test";
import { agreeToTerms } from "./terms";

// Sign-up screens up to the point where an email would be sent. Flows that need a real inbox
// or a seeded session run against a local Supabase stack (Phase 1 part 3).

test("welcome → campus → email fork → UoS email", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "FIND YOUR BATCH." })).toBeVisible();
  await page.getByRole("link", { name: "Get started" }).click();

  await expect(page).toHaveURL(/\/start\/campus$/);
  await expect(page.getByRole("radio", { name: /University of Sargodha/ })).toBeVisible();
  // Sign-up starts by agreeing to the terms.
  const next = page.getByRole("button", { name: "Continue" });
  await expect(next).toBeDisabled();
  await page.getByRole("checkbox", { name: /I agree to the Terms and Privacy Policy/ }).check();
  await next.click();

  await expect(page).toHaveURL(/\/start\/email$/);
  await page.getByRole("link", { name: /Yes, I have it/ }).click();
  await expect(page).toHaveURL(/\/start\/uni-email$/);
  await expect(page.getByRole("heading", { name: "Sign in with your UoS email" })).toBeVisible();
});

test("skipping the first screen leads back to the terms", async ({ page }) => {
  await page.goto("/start/freshman");
  await expect(page).toHaveURL(/\/start\/campus$/);
});

test("a non-UoS address is caught before any email is sent", async ({ page, baseURL }) => {
  await agreeToTerms(page, baseURL);
  await page.goto("/start/uni-email");
  await page.getByLabel("UoS email").fill("someone@gmail.com");
  await page.getByRole("button", { name: "Email me a code" }).click();
  // Not getByRole("alert"): Next.js renders its own route-announcer alert.
  await expect(page.getByText("That's not a UoS email.")).toBeVisible();
  await expect(page.getByRole("link", { name: /Join with your student ID/ })).toHaveAttribute(
    "href",
    "/start/freshman",
  );
});

test("the fresher form validates before creating an account", async ({ page, baseURL }) => {
  await agreeToTerms(page, baseURL);
  await page.goto("/start/freshman");
  await page.getByLabel("Password").fill("short");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Enter your full name")).toBeVisible();
  await expect(page.getByText("Enter a valid email")).toBeVisible();
  await expect(page.getByText("Use at least 8 characters")).toBeVisible();
});

test("the waitlist dialog opens from the campus screen", async ({ page }) => {
  await page.goto("/start/campus");
  await page.getByRole("button", { name: /Request your university/ }).click();
  await expect(page.getByRole("dialog", { name: "Request your university" })).toBeVisible();
});

for (const path of ["/pending", "/setup", "/start/freshman/proof", "/admin/verifications"]) {
  test(`${path} sends visitors to log in`, async ({ page }) => {
    await page.goto(path);
    await expect(page).toHaveURL(`/login?next=${encodeURIComponent(path)}`);
    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  });
}

for (const path of [
  "/start/campus",
  "/start/email",
  "/start/uni-email",
  "/start/freshman",
  "/login",
]) {
  test(`${path} has no horizontal scroll`, async ({ page, baseURL }) => {
    await agreeToTerms(page, baseURL);
    await page.goto(path);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);
  });
}
