import { createClient } from "@supabase/supabase-js";
import { expect, test, type APIRequestContext } from "@playwright/test";

// Full sign-up flows against a local Supabase stack (the CI "e2e" job). Emails are caught by
// Mailpit, so the codes can be read back. Skipped wherever that stack isn't running.
test.skip(!process.env.E2E_DB, "needs a local Supabase stack (E2E_DB=1)");

const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";
const run = Date.now().toString(36);
// A 1×1 PNG: enough to exercise compression, upload and review.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

/** The newest code emailed to `to`, waiting for it to arrive. */
async function emailedCode(request: APIRequestContext, to: string) {
  let code: string | undefined;
  await expect
    .poll(
      async () => {
        const search = await request.get(`${MAILPIT}/api/v1/search`, {
          params: { query: `to:"${to}"` },
        });
        const id = (await search.json()).messages?.[0]?.ID;
        if (!id) return undefined;
        const message = await (await request.get(`${MAILPIT}/api/v1/message/${id}`)).json();
        const body = `${message.Text ?? ""} ${String(message.HTML ?? "").replace(/<[^>]+>/g, " ")}`;
        code = /\b(\d{6,10})\b/.exec(body)?.[1];
        return code;
      },
      { timeout: 20_000, message: `no code emailed to ${to}` },
    )
    .toBeTruthy();
  return code!;
}

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

test("a UoS email is verified instantly and lands on setup", async ({ page, request }) => {
  const email = `student-${run}@uos.edu.pk`;
  await page.goto("/start/uni-email");
  await page.getByLabel("UoS email").fill(email);
  await page.getByRole("button", { name: "Email me a code" }).click();
  await page.getByLabel("Code").fill(await emailedCode(request, email));
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page).toHaveURL(/\/setup$/);
  await expect(page.getByRole("heading", { name: /You're in/ })).toBeVisible();
  await expect(page.getByText("UoS email", { exact: true })).toBeVisible();
});

test("a fresher submits proof, an admin approves, and the student moves on live", async ({
  browser,
  request,
}) => {
  // An admin, created directly (the app's own path is `pnpm admin:grant`).
  const adminEmail = `admin-${run}@example.com`;
  const adminPassword = `Admin-${run}-pass!`;
  const db = serviceClient();
  const { data: created, error } = await db.auth.admin.createUser({
    email: adminEmail,
    password: adminPassword,
    email_confirm: true,
  });
  expect(error).toBeNull();
  const { error: grantError } = await db
    .from("profiles")
    .update({
      role: "admin",
      verification_status: "verified",
      verification_method: "admin_manual",
      verified_at: new Date().toISOString(),
    })
    .eq("id", created.user!.id);
  expect(grantError).toBeNull();

  // The student signs up and confirms their email.
  const student = await (await browser.newContext()).newPage();
  const email = `fresher-${run}@example.com`;
  await student.goto("/start/freshman");
  await student.getByLabel("Full name").fill("Bilal Ahmed");
  await student.getByLabel("Personal email").fill(email);
  await student.getByLabel("Password").fill(`Fresher-${run}-pass!`);
  await student.getByRole("button", { name: "Continue" }).click();
  await student.getByLabel("Code").fill(await emailedCode(request, email));
  await student.getByRole("button", { name: "Confirm email" }).click();

  // …then submits their roll number and proof.
  await expect(student).toHaveURL(/\/start\/freshman\/proof$/);
  await student.getByLabel("Roll or registration number").fill("bscs51f22s037");
  await student
    .locator('input[type="file"][accept*="pdf"]')
    .setInputFiles({ name: "card.png", mimeType: "image/png", buffer: PNG });
  await student.getByRole("button", { name: "Submit for review" }).click();
  await expect(student).toHaveURL(/\/pending$/);
  await expect(student.getByRole("heading", { name: "You're in the queue" })).toBeVisible();

  // The admin reviews it.
  const admin = await (await browser.newContext()).newPage();
  await admin.goto("/login");
  await admin.getByRole("tab", { name: "Personal email" }).click();
  // Scoped and exact: the tab panel itself is labelled "Personal email".
  const passwordTab = admin.getByRole("tabpanel", { name: "Personal email" });
  await passwordTab.getByLabel("Email", { exact: true }).fill(adminEmail);
  await passwordTab.getByLabel("Password", { exact: true }).fill(adminPassword);
  await passwordTab.getByRole("button", { name: "Log in" }).click();
  await expect(admin).toHaveURL(/\/setup$/);
  await admin.goto("/admin/verifications");
  await expect(admin.getByText("Bilal Ahmed").first()).toBeVisible();
  await expect(admin.getByText("BSCS51F22S037")).toBeVisible();
  await admin.getByRole("button", { name: "Approve" }).click();
  await expect(admin.getByText("The queue is clear")).toBeVisible();

  // The student's open page follows the decision without a reload (realtime; the 20 s poll is
  // only a fallback, so a pass well inside this timeout means realtime delivered it).
  await expect(student).toHaveURL(/\/setup$/, { timeout: 15_000 });
  await expect(student.getByRole("heading", { name: /You're in, Bilal/ })).toBeVisible();
});

test("the retention job needs its secret and runs against storage", async ({ request }) => {
  expect((await request.get("/api/cron/purge-documents")).status()).toBe(401);
  const res = await request.get("/api/cron/purge-documents", {
    headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
  });
  expect(res.status()).toBe(200);
  expect(await res.json()).toEqual({ removed: 0 });
});
