// Mints a session token for each seeded load-test student (HS256 with the stack's JWT
// secret), so k6 can call the API as 500 different students without 500 logins.
//   DB_URL=... JWT_SECRET=... node load/tokens.mjs > load/tokens.json
import { execFileSync } from "node:child_process";
import { createHmac } from "node:crypto";

const { DB_URL, JWT_SECRET } = process.env;
if (!DB_URL || !JWT_SECRET) throw new Error("Set DB_URL and JWT_SECRET");

const ids = execFileSync(
  "psql",
  [
    DB_URL,
    "-At",
    "-c",
    "select id from auth.users where email like 'load-%@example.com' order by email",
  ],
  { encoding: "utf8" },
)
  .split("\n")
  .filter(Boolean);

const b64 = (v) => Buffer.from(typeof v === "string" ? v : JSON.stringify(v)).toString("base64url");
const now = Math.floor(Date.now() / 1000);
const users = ids.map((sub) => {
  const head = b64({ alg: "HS256", typ: "JWT" });
  const body = b64({ sub, role: "authenticated", aud: "authenticated", iat: now, exp: now + 3600 });
  const sig = createHmac("sha256", JWT_SECRET).update(`${head}.${body}`).digest("base64url");
  return { id: sub, token: `${head}.${body}.${sig}` };
});
process.stdout.write(JSON.stringify({ users }));
