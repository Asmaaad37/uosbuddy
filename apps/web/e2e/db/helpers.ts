import { createClient } from "@supabase/supabase-js";
import { expect, type Page } from "@playwright/test";

// Shared by the e2e/db specs: sample students made directly through the service role.

export const run = Date.now().toString(36);
export const WIDTHS = [
  { name: "375", width: 375, height: 812 },
  { name: "1280", width: 1280, height: 800 },
];

export const db = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

/** A verified student with a filled-in profile, made directly through the service role. */
export async function makeStudent(
  name: string,
  handle: string,
  onboardingStep: number,
  extra: Record<string, unknown> = {},
  interestLabels = ["Cricket", "Coding", "Chai", "Photography", "Gaming"],
) {
  const supabase = db();
  const email = `${handle}-${run}@example.com`;
  const password = `Screens-${run}-pass!`;
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  expect(error).toBeNull();
  const id = data.user!.id;

  const { data: dept } = await supabase
    .from("departments")
    .select("id")
    .eq("short_code", "CS")
    .single();
  const { data: program } = await supabase
    .from("programs")
    .select("id")
    .eq("name", "BS in Computer Science")
    .single();
  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      full_name: name,
      handle,
      verification_status: "verified",
      verification_method: "document",
      verified_at: new Date().toISOString(),
      department_id: dept!.id,
      program_id: program!.id,
      batch_year: 2024,
      semester: 5,
      section: "B",
      shift: "morning",
      residence: "hostelite",
      hometown_city: "Sargodha",
      bio: "CS student. Usually found in the library or at the cricket ground.",
      opening_move_prompt: "Best chai spot near campus is…",
      opening_move: "The dhaba behind the main gate, no contest.",
      onboarding_step: onboardingStep,
      ...extra,
    })
    .eq("id", id);
  expect(profileError).toBeNull();

  const { data: interests } = await supabase
    .from("interests")
    .select("id, label")
    .in("label", interestLabels);
  await supabase
    .from("profile_interests")
    .insert((interests ?? []).map((i) => ({ user_id: id, interest_id: i.id })));
  await supabase
    .from("privacy_settings")
    .update({ profile_visibility: "everyone", photo_visibility: "everyone" })
    .eq("user_id", id);

  return { id, email, password, handle };
}

export async function logIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByRole("tab", { name: "Personal email" }).click();
  const panel = page.getByRole("tabpanel", { name: "Personal email" });
  await panel.getByLabel("Email", { exact: true }).fill(email);
  await panel.getByLabel("Password", { exact: true }).fill(password);
  await panel.getByRole("button", { name: "Log in" }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

/** A one-page PDF with real, extractable text (each line drawn with Tj). */
export function textPdf(lines: string[]) {
  const esc = (s: string) => s.replace(/[\\()]/g, (c) => `\\${c}`);
  const stream = `BT /F1 11 Tf 50 780 Td 14 TL ${lines.map((l) => `(${esc(l)}) '`).join(" ")} ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = objects.map((body, i) => {
    const at = pdf.length;
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
    return at;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, "latin1");
}
