// Generates packages/shared/src/database.types.ts, writing the file only when generation succeeds.
// Usage: node scripts/gen-types.mjs [--linked|--local]
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const target = new URL("../packages/shared/src/database.types.ts", import.meta.url);
const source = process.argv[2] === "--local" ? "--local" : "--linked";

let types;
try {
  types = execSync(`supabase gen types typescript ${source}`, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });
} catch {
  console.error("Type generation failed; database.types.ts was left unchanged.");
  process.exit(1);
}

if (!types.includes("export type Database")) {
  console.error("Unexpected output; database.types.ts was left unchanged:\n" + types.slice(0, 500));
  process.exit(1);
}

writeFileSync(target, types);
console.log("Wrote packages/shared/src/database.types.ts");
