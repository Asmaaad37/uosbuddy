import { createClient } from "@supabase/supabase-js";
import { expect, test, type APIRequestContext } from "@playwright/test";
import { TERMS_VERSION } from "../../lib/terms";
import { agreeToTerms } from "../terms";

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

test("a UoS email is verified instantly and completes profile setup", async ({
  page,
  request,
  baseURL,
}) => {
  const email = `student-${run}@uos.edu.pk`;
  await agreeToTerms(page, baseURL);
  await page.goto("/start/uni-email");
  await page.getByLabel("UoS email").fill(email);
  await page.getByRole("button", { name: "Email me a code" }).click();
  await page.getByLabel("Code").fill(await emailedCode(request, email));
  await page.getByRole("button", { name: "Continue" }).click();

  // Screen 6: academic.
  await expect(page).toHaveURL(/\/setup\/academic$/);
  await page.getByLabel("Department").selectOption({ label: "Computer Science" });
  await page.getByLabel("Program").selectOption({ label: "BS in Computer Science" });
  await page.getByLabel(/Session/).selectOption("2024");
  await page.getByLabel("Semester").selectOption("5");
  await page.getByLabel(/Section/).selectOption("REG");
  await page.getByRole("radio", { name: "Morning" }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  // Autosave: a reload (or coming back later) resumes at the next unfinished step.
  await expect(page).toHaveURL(/\/setup\/about$/);
  await page.goto("/setup");
  await expect(page).toHaveURL(/\/setup\/about$/);

  // Screen 7: about you.
  await page.getByLabel("Handle").fill(`stu_${run}`.slice(0, 20));
  await expect(page.getByText(/Your profile link/)).toBeVisible();
  await page.getByRole("radio", { name: "Hostelite" }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  // Screen 8: interests.
  await expect(page).toHaveURL(/\/setup\/interests$/);

  // The handle is saved now. Agreeing to the terms at the start of sign-up was saved too.
  const { data: agreed } = await serviceClient()
    .from("profiles")
    .select("terms_version, terms_accepted_at")
    .eq("handle", `stu_${run}`.slice(0, 20))
    .single();
  expect(agreed?.terms_version).toBe(TERMS_VERSION);
  expect(agreed?.terms_accepted_at).not.toBeNull();

  await page.getByRole("button", { name: "Cricket" }).click();
  await page.getByRole("button", { name: "Coding" }).click();
  await expect(page.getByText("2/10 picked")).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();

  // Screen 9: privacy, then done.
  await expect(page).toHaveURL(/\/setup\/privacy$/);
  await page.getByRole("radio", { name: /Batch only/ }).click();
  await page.getByRole("button", { name: "Finish" }).click();
  // Phase 3: finishing setup lands on the batch reveal.
  await expect(page).toHaveURL(/\/explore\?welcome=1$/);
  await expect(page.getByRole("heading", { name: "Explore", level: 1 })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /already here|first from CS 2024/ }),
  ).toBeVisible();

  // What was saved.
  const { data: saved } = await serviceClient()
    .from("profiles")
    .select("section, shift, residence, onboarding_step, privacy_settings(profile_visibility)")
    .eq("handle", `stu_${run}`.slice(0, 20))
    .single();
  expect(saved).toMatchObject({
    section: "REG",
    shift: "morning",
    residence: "hostelite",
    onboarding_step: 4,
    privacy_settings: { profile_visibility: "batch" },
  });

  // Phase 2 part 3: the profile hub, editing, the public profile and privacy settings.
  const handle = `stu_${run}`.slice(0, 20);
  await page.getByRole("link", { name: "My profile" }).click();
  await expect(page).toHaveURL(/\/me$/);
  await expect(page.getByText("UoS email", { exact: true })).toBeVisible();
  // Section, UoS email: 2 of 7 done.
  await expect(page.getByRole("heading", { name: "Finish your profile" })).toBeVisible();
  await expect(page.getByRole("progressbar", { name: "Profile completeness" })).toHaveAttribute(
    "aria-valuenow",
    "29",
  );

  await page.getByRole("link", { name: "Write a short bio" }).click();
  await expect(page).toHaveURL(/\/setup\/about\?edit=1$/);
  await expect(page.getByRole("list", { name: /^Step/ })).toHaveCount(0);
  await page.getByLabel("Bio (optional)").fill("Here for the cricket.");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page).toHaveURL(/\/me$/);
  await expect(page.getByRole("progressbar", { name: "Profile completeness" })).toHaveAttribute(
    "aria-valuenow",
    "43",
  );

  await page.getByRole("link", { name: /View my profile/ }).click();
  await expect(page).toHaveURL(new RegExp(`/people/${handle}$`));
  await expect(page.getByText("BS in Computer Science")).toBeVisible();
  await expect(page.getByText("Batch 2024 · Semester 5 · Section REG · Morning")).toBeVisible();
  await expect(page.getByText("Here for the cricket.")).toBeVisible();
  await expect(page.getByRole("list").getByText("Cricket")).toBeVisible();
  // Handles are case-insensitive; the canonical one wins.
  await page.goto(`/people/${handle.toUpperCase()}`);
  await expect(page).toHaveURL(new RegExp(`/people/${handle}$`));
  await page.goto("/people/nobody_here_x");
  await expect(page.getByRole("heading", { name: "Profile not available" })).toBeVisible();

  await page.goto("/me/privacy");
  await page.getByRole("radio", { name: /^Open/ }).click();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page).toHaveURL(/\/me$/);
  const { data: privacy } = await serviceClient()
    .from("profiles")
    .select("privacy_settings(profile_visibility)")
    .eq("handle", handle)
    .single();
  expect(privacy).toMatchObject({ privacy_settings: { profile_visibility: "everyone" } });
});

test("a fresher submits proof, an admin approves, and the student moves on live", async ({
  browser,
  request,
  baseURL,
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
  await agreeToTerms(student, baseURL);
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
  // Wait for the live channel: on a cold CI stack the first subscription can take a while,
  // and a decision made before it joins would only show up on the 20 s poll.
  await expect(student.getByText(/^Live:/)).toBeVisible({ timeout: 30_000 });

  // The admin reviews it.
  const admin = await (await browser.newContext()).newPage();
  await admin.goto("/login");
  await admin.getByRole("tab", { name: "Password" }).click();
  // Scoped and exact: the tab panel itself is labelled "Password".
  const passwordTab = admin.getByRole("tabpanel", { name: "Password" });
  await passwordTab.getByLabel("Email", { exact: true }).fill(adminEmail);
  await passwordTab.getByLabel("Password", { exact: true }).fill(adminPassword);
  await passwordTab.getByRole("button", { name: "Log in" }).click();
  await expect(admin).toHaveURL(/\/setup\/academic$/);
  await admin.goto("/admin/verifications");
  await expect(admin.getByText("Bilal Ahmed").first()).toBeVisible();
  await expect(admin.getByText("BSCS51F22S037", { exact: true })).toBeVisible();
  // Phase 7: the AI pre-check (faked in CI) is shown as a hint; the admin still decides.
  if (process.env.AI_FAKE) {
    await expect(admin.getByRole("region", { name: "AI pre-check" })).toContainText("100% match");
  }
  await admin.getByRole("button", { name: "Approve" }).click();
  await expect(admin.getByText("The queue is clear")).toBeVisible();

  // The student's open page follows the decision without a reload (realtime; the 20 s poll is
  // only a fallback, so a pass well inside this timeout means realtime delivered it).
  await expect(student).toHaveURL(/\/setup\/academic$/, { timeout: 15_000 });
  await expect(student.getByRole("heading", { name: "What do you study?" })).toBeVisible();
});

test("the retention job needs its secret and runs against storage", async ({ request }) => {
  expect((await request.get("/api/cron/purge-documents")).status()).toBe(401);
  const res = await request.get("/api/cron/purge-documents", {
    headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
  });
  expect(res.status()).toBe(200);
  expect(await res.json()).toMatchObject({ removed: 0, exports: 0, orphans: expect.any(Number) });
});
