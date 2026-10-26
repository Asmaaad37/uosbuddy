import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

const config = [
  { ignores: [".next/**", "node_modules/**", "public/sw.js", "next-env.d.ts"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // The service-role key must never be imported into client code.
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/lib/supabase/admin",
              message: "Server-only. Import only from server actions or route handlers.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["app/api/**", "app/auth/**", "actions/**", "lib/supabase/**", "**/*.server.ts"],
    rules: { "no-restricted-imports": "off" },
  },
];

export default config;
