// Embeddings for course-file search (Phase 7): Supabase's built-in gte-small model
// (English, 384 dimensions; inputs over 512 tokens are truncated). The gateway verifies
// the caller's JWT (verify_jwt stays on); this function additionally requires a signed-in
// user (role "authenticated"), so the project's public key alone can't use it.
const model = new Supabase.ai.Session("gte-small");

function role(req: Request): string | null {
  const token = req.headers.get("Authorization")?.replace(/^Bearer /, "");
  const payload = token?.split(".")[1];
  if (!payload) return null;
  try {
    const json = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    return typeof json.role === "string" ? json.role : null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (role(req) !== "authenticated") {
    return new Response(JSON.stringify({ error: "Sign in first" }), { status: 401 });
  }
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  let texts: unknown;
  try {
    ({ texts } = await req.json());
  } catch {
    return new Response(JSON.stringify({ error: "Bad JSON" }), { status: 400 });
  }
  if (
    !Array.isArray(texts) ||
    texts.length === 0 ||
    texts.length > 64 ||
    texts.some((t) => typeof t !== "string" || t.length > 8000)
  ) {
    return new Response(JSON.stringify({ error: "Send 1–64 texts of up to 8,000 characters" }), {
      status: 400,
    });
  }

  const embeddings: number[][] = [];
  for (const text of texts as string[]) {
    embeddings.push((await model.run(text, { mean_pool: true, normalize: true })) as number[]);
  }
  return new Response(JSON.stringify({ embeddings }), {
    headers: { "Content-Type": "application/json" },
  });
});
