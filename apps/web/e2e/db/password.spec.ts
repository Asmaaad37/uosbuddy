import { expect, test } from "@playwright/test";
import { db, logIn, makeStudent, run } from "./helpers";

test("the reset link lets a student choose a new password", async ({ page, browser }, info) => {
  const handle = `pw${info.project.name[0]}_${run}`.slice(0, 20);
  const student = await makeStudent("Reset Tester", handle, 4);
  const newPassword = `Reset-${run}-pass!`;

  await page.goto("/login");
  await page.getByRole("tab", { name: "Password" }).click();
  await page.getByRole("link", { name: "Forgot password?" }).click();
  await expect(page).toHaveURL(/\/forgot-password$/);
  await page.getByLabel("Email").fill(student.email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByRole("status")).toContainText("we've sent it a link");

  const { data } = await db().auth.admin.generateLink({ type: "recovery", email: student.email });
  await page.goto(`/auth/confirm?token_hash=${data.properties!.hashed_token}&type=recovery`);
  await expect(page).toHaveURL(/\/reset-password$/);

  await page.getByLabel("New password").fill("short");
  await page.getByRole("button", { name: "Save new password" }).click();
  await expect(page.getByText("Use at least 8 characters")).toBeVisible();
  await page.getByLabel("New password").fill(newPassword);
  await page.getByRole("button", { name: "Save new password" }).click();
  await expect(page).toHaveURL(/\/explore/);

  const fresh = await (await browser.newContext()).newPage();
  await logIn(fresh, student.email, newPassword);
  await expect(fresh).toHaveURL(/\/explore/);
});

test("the reset screen sends signed-out visitors to log in", async ({ page }) => {
  await page.goto("/reset-password");
  await expect(page).toHaveURL(/\/login\?error=link$/);
});
