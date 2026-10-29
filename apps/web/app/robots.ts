import type { MetadataRoute } from "next";
import { publicEnv } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Signed-in and internal pages are useless to crawlers and may show private data.
      disallow: [
        "/admin",
        "/api",
        "/auth",
        "/pending",
        "/setup",
        "/explore",
        "/me",
        "/start/freshman/proof",
        "/design",
      ],
    },
    sitemap: new URL("/sitemap.xml", publicEnv.NEXT_PUBLIC_SITE_URL).toString(),
  };
}
