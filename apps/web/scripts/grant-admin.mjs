// Make an existing account an admin (and verified). Run after that person has signed up.
// Usage: pnpm admin:grant someone@example.com
import { createClient } from "@supabase/supabase-js";

const email = process.argv[2]?.trim().toLowerCase();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!email || !email.includes("@")) {
  console.error("Usage: pnpm admin:grant someone@example.com");
  process.exit(1);
}
if (!url || !key) {
  console.error(
    "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in apps/web/.env.local",
  );
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

// The service role bypasses RLS; emails live in private_profile (personal or university).
let userId;
for (const column of ["personal_email", "uni_email"]) {
  const { data, error } = await db
    .from("private_profile")
    .select("user_id")
    .eq(column, email)
    .maybeSingle();
  if (error) throw error;
  if (data) userId = data.user_id;
  if (userId) break;
}
if (!userId) {
  console.error(`No account with ${email}. Sign up in the app first (and confirm the email).`);
  process.exit(1);
}

const { data: before, error: readError } = await db
  .from("profiles")
  .select("role, verification_status, verification_method, verified_at")
  .eq("id", userId)
  .single();
if (readError) throw readError;

const verified = before.verification_status === "verified";
const after = {
  role: "admin",
  verification_status: "verified",
  verification_method: verified ? before.verification_method : "admin_manual",
  verified_at: verified ? before.verified_at : new Date().toISOString(),
};

const { error: updateError } = await db.from("profiles").update(after).eq("id", userId);
if (updateError) throw updateError;

// Close any document request still waiting, so it doesn't sit in the review queue.
await db
  .from("verification_requests")
  .update({
    status: "verified",
    decision_reason: "Granted admin",
    decided_at: new Date().toISOString(),
  })
  .eq("user_id", userId)
  .in("status", ["pending", "needs_info"]);

await db.from("audit_log").insert({
  actor_id: null,
  action: "admin.grant",
  target_type: "profile",
  target_id: userId,
  before,
  after,
});

console.log(`${email} is now an admin.`);
